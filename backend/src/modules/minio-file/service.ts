import { AbstractFileProviderService, MedusaError } from '@medusajs/framework/utils';
import { Logger } from '@medusajs/framework/types';
import {
  ProviderUploadFileDTO,
  ProviderDeleteFileDTO,
  ProviderFileResultDTO,
  ProviderGetFileDTO,
  ProviderGetPresignedUploadUrlDTO
} from '@medusajs/framework/types';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { ulid } from 'ulid';
import { Readable } from 'stream';

type InjectedDependencies = {
  logger: Logger
}

interface MinioServiceConfig {
  endPoint: string
  publicEndPoint?: string
  accessKey: string
  secretKey: string
  bucket?: string
}

export interface MinioFileProviderOptions {
  endPoint: string
  publicEndPoint?: string
  accessKey: string
  secretKey: string
  bucket?: string
}

const DEFAULT_BUCKET = 'medusa-media'

/**
 * Service to handle file storage using MinIO (via AWS SDK v3 S3 client).
 */
class MinioFileProviderService extends AbstractFileProviderService {
  static identifier = 'minio-file'
  protected readonly config_: MinioServiceConfig
  protected readonly logger_: Logger
  protected client: S3Client
  protected readonly bucket: string
  protected readonly useSSL: boolean
  protected readonly publicEndPoint: string | null
  protected readonly endpointUrl: string

  constructor({ logger }: InjectedDependencies, options: MinioFileProviderOptions) {
    super()
    this.logger_ = logger

    // Parse endpoint to build full URL for AWS SDK
    let endPoint = options.endPoint
    let useSSL = true
    let port: number | undefined = undefined
    let protocol = 'https'

    // Detect protocol from endpoint string
    if (endPoint.startsWith('https://')) {
      endPoint = endPoint.replace('https://', '')
      useSSL = true
      protocol = 'https'
    } else if (endPoint.startsWith('http://')) {
      endPoint = endPoint.replace('http://', '')
      useSSL = false
      protocol = 'http'
    }

    // Remove trailing slash if present
    endPoint = endPoint.replace(/\/$/, '')

    // Extract port from endpoint if specified (e.g., "minio.example.com:9000")
    const portMatch = endPoint.match(/:(\d+)$/)
    if (portMatch) {
      port = parseInt(portMatch[1], 10)
      endPoint = endPoint.replace(/:(\d+)$/, '')
    }

    this.config_ = {
      endPoint: endPoint,
      publicEndPoint: options.publicEndPoint,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
      bucket: options.bucket
    }

    // Use provided bucket or default
    this.bucket = this.config_.bucket || DEFAULT_BUCKET
    this.useSSL = useSSL
    // Store public endpoint for URL generation (falls back to connection endpoint)
    this.publicEndPoint = options.publicEndPoint || null

    // Build the full endpoint URL for AWS SDK
    const portSuffix = port ? `:${port}` : ''
    this.endpointUrl = `${protocol}://${endPoint}${portSuffix}`

    this.logger_.info(`MinIO service initialized with bucket: ${this.bucket}, endpoint: ${this.endpointUrl}, SSL: ${useSSL}, publicEndPoint: ${this.publicEndPoint || '(same as endpoint)'}`)

    // Initialize AWS S3 client configured for MinIO
    this.client = new S3Client({
      endpoint: this.endpointUrl,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.config_.accessKey,
        secretAccessKey: this.config_.secretKey,
      },
      forcePathStyle: true, // Required for MinIO (uses path-style URLs instead of virtual-hosted)
    })

    // Initialize bucket and policy
    this.initializeBucket().catch(error => {
      this.logger_.error(`Failed to initialize MinIO bucket: ${error.message}`)
    })
  }

  static validateOptions(options: Record<string, any>) {
    const requiredFields = [
      'endPoint',
      'accessKey',
      'secretKey'
    ]

    requiredFields.forEach((field) => {
      if (!options[field]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `${field} is required in the provider's options`
        )
      }
    })
  }

  private async initializeBucket(): Promise<void> {
    try {
      // Check if bucket exists
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
        this.logger_.info(`Using existing bucket: ${this.bucket}`)
      } catch (headErr: any) {
        // Bucket doesn't exist, create it
        if (headErr.name === 'NotFound' || headErr.$metadata?.httpStatusCode === 404 || headErr.name === 'NoSuchBucket') {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
          this.logger_.info(`Created bucket: ${this.bucket}`)
        } else {
          throw headErr
        }
      }

      // Set bucket policy to allow public read access
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`]
          }
        ]
      }

      try {
        await this.client.send(new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify(policy)
        }))
        this.logger_.info(`Set public read policy for bucket: ${this.bucket}`)
      } catch (policyError: any) {
        this.logger_.warn(`Failed to set policy for bucket: ${policyError.message}`)
      }
    } catch (error: any) {
      this.logger_.error(`Error initializing bucket: ${error.message}`)
      throw error
    }
  }

  async upload(
    file: ProviderUploadFileDTO
  ): Promise<ProviderFileResultDTO> {
    if (!file) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file provided'
      )
    }

    if (!file.filename) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No filename provided'
      )
    }

    try {
      const parsedFilename = path.parse(file.filename)
      const fileKey = `${parsedFilename.name}-${ulid()}${parsedFilename.ext}`

      // Handle different content types properly
      let content: Buffer
      if (Buffer.isBuffer(file.content)) {
        content = file.content
      } else if (typeof file.content === 'string') {
        // If it's a base64 string, decode it
        if (file.content.match(/^[A-Za-z0-9+/]+=*$/)) {
          content = Buffer.from(file.content, 'base64')
        } else {
          content = Buffer.from(file.content, 'binary')
        }
      } else {
        // Handle ArrayBuffer, Uint8Array, or any other buffer-like type
        content = Buffer.from(file.content as any)
      }

      // Upload file using AWS SDK PutObject
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: content,
        ContentLength: content.length,
        ContentType: file.mimeType,
        Metadata: {
          'original-filename': file.filename
        }
      }))

      // Generate URL using the public endpoint (or connection endpoint as fallback)
      let url: string
      if (this.publicEndPoint) {
        // Use the public endpoint for URLs (strip trailing slash, ensure https)
        const pubEp = this.publicEndPoint.replace(/\/$/, '')
        const pubUrl = pubEp.startsWith('http') ? pubEp : `https://${pubEp}`
        url = `${pubUrl}/${this.bucket}/${fileKey}`
      } else {
        url = `${this.endpointUrl}/${this.bucket}/${fileKey}`
      }

      this.logger_.info(`Successfully uploaded file ${fileKey} to MinIO bucket ${this.bucket}`)

      return {
        url,
        key: fileKey
      }
    } catch (error: any) {
      this.logger_.error(`Failed to upload file: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to upload file: ${error.message}`
      )
    }
  }

  async delete(
    fileData: ProviderDeleteFileDTO | ProviderDeleteFileDTO[]
  ): Promise<void> {
    const files = Array.isArray(fileData) ? fileData : [fileData];

    for (const file of files) {
      if (!file?.fileKey) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          'No file key provided'
        );
      }

      try {
        await this.client.send(new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: file.fileKey
        }));
        this.logger_.info(`Successfully deleted file ${file.fileKey} from MinIO bucket ${this.bucket}`);
      } catch (error: any) {
        this.logger_.warn(`Failed to delete file ${file.fileKey}: ${error.message}`);
      }
    }
  }

  async getPresignedDownloadUrl(
    fileData: ProviderGetFileDTO
  ): Promise<string> {
    if (!fileData?.fileKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file key provided'
      )
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileData.fileKey,
      })
      const url = await getSignedUrl(this.client, command, {
        expiresIn: 24 * 60 * 60 // URL expires in 24 hours
      })
      this.logger_.info(`Generated presigned URL for file ${fileData.fileKey}`)
      return url
    } catch (error: any) {
      this.logger_.error(`Failed to generate presigned URL: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to generate presigned URL: ${error.message}`
      )
    }
  }

  async getPresignedUploadUrl(
    fileData: ProviderGetPresignedUploadUrlDTO
  ): Promise<ProviderFileResultDTO> {
    if (!fileData?.filename) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No filename provided'
      )
    }

    try {
      // Use the filename directly as the key (matches S3 provider behavior for presigned uploads)
      const fileKey = fileData.filename

      // Generate presigned PUT URL that expires in 15 minutes
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      })
      const url = await getSignedUrl(this.client, command, {
        expiresIn: 15 * 60 // URL expires in 15 minutes
      })

      return {
        url,
        key: fileKey
      }
    } catch (error: any) {
      this.logger_.error(`Failed to generate presigned upload URL: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to generate presigned upload URL: ${error.message}`
      )
    }
  }

  async getAsBuffer(fileData: ProviderGetFileDTO): Promise<Buffer> {
    if (!fileData?.fileKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file key provided'
      )
    }

    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileData.fileKey,
      }))

      // Convert the readable stream to a buffer
      const stream = response.Body as Readable
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
      })

      this.logger_.info(`Retrieved buffer for file ${fileData.fileKey}`)
      return buffer
    } catch (error: any) {
      this.logger_.error(`Failed to get buffer: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to get buffer: ${error.message}`
      )
    }
  }

  async getDownloadStream(fileData: ProviderGetFileDTO): Promise<Readable> {
    if (!fileData?.fileKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file key provided'
      )
    }

    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileData.fileKey,
      }))

      this.logger_.info(`Retrieved download stream for file ${fileData.fileKey}`)
      return response.Body as Readable
    } catch (error: any) {
      this.logger_.error(`Failed to get download stream: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to get download stream: ${error.message}`
      )
    }
  }
}

export default MinioFileProviderService
