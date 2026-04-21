// Sample email HTML used as default body when a new "email" node is added to a flow.
// Content mirrors the rose/mauve palette Joris story template (story framework example).
// Dispatcher-injected placeholders: {{ view_in_browser_text }}, {{ view_in_browser_label }},
// {{ view_in_browser_url }}, {{ first_name }}, {{ unsubscribe_url }}.
export const SAMPLE_EMAIL_HTML = String.raw`
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="nl" style="background:#faf5f8;">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="format-detection" content="telephone=no">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<base target="_blank">
<title>de man die zijn vader nooit belde</title>

<!--[if mso]>
<style type="text/css">
  body, table, td { font-family: Georgia, 'Times New Roman', serif !important; }
</style>
<![endif]-->

<style type="text/css">
  html { background:#faf5f8; }
  body { margin:0 !important; padding:0 !important; width:100% !important; background:#faf5f8 !important; }
  table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { display:block; border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; max-width:100%; height:auto; }

  a { color:#8C2E54; }
  a:hover { color:#6B2240; }

  .hl-yellow {
    background: linear-gradient(180deg, transparent 55%, #FFE66D 55%);
    padding: 0 2px;
    font-weight: 600;
  }
  .hl-red {
    background: linear-gradient(180deg, transparent 55%, #F4A9A9 55%);
    padding: 0 2px;
    font-weight: 600;
  }

  @media only screen and (max-width:640px) {
    .em-container { width:100% !important; max-width:100% !important; }
    .em-pad { padding-left:22px !important; padding-right:22px !important; }
    .em-body-text { font-size:16px !important; line-height:1.6 !important; }
    .em-heading { font-size:24px !important; line-height:1.3 !important; }
    .em-cta { display:block !important; width:100% !important; box-sizing:border-box !important; }
    .em-hide-mobile { display:none !important; }
  }

  /* Dark mode — preserve palette across Gmail / Outlook / Apple Mail dark schemes */
  @media (prefers-color-scheme: dark) {
    .em-bg { background:#faf5f8 !important; }
    .em-card { background:#FFFFFF !important; }
    .em-text { color:#1F1B16 !important; }
  }
  [data-ogsc] .em-bg { background:#faf5f8 !important; }
  [data-ogsc] .em-card { background:#FFFFFF !important; }
  [data-ogsc] .em-text { color:#1F1B16 !important; }
</style>
</head>

<body bgcolor="#faf5f8" style="margin:0;padding:0;background:#faf5f8;font-family:Georgia,'Times New Roman',serif;color:#1F1B16;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#faf5f8;opacity:0;">
  Mark wachtte twaalf jaar op het juiste moment. Toen was het te laat. Wat ik van hem leerde over uitstellen.
  &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847;
</div>

<div role="article" aria-roledescription="email" aria-label="de man die zijn vader nooit belde" lang="nl">

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#faf5f8" class="em-bg" style="background:#faf5f8;">
<tr>
<td bgcolor="#faf5f8" align="center" class="em-bg" style="background:#faf5f8;padding:28px 14px 40px 14px;">

  <!-- View in browser — localized per brand.locale (dispatcher injects view_in_browser_* vars) -->
  <table role="presentation" class="em-container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;">
    <tr>
      <td align="center" style="padding:0 14px 12px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#8A7884;">
        {{ view_in_browser_text }}
        <a href="{{ view_in_browser_url }}" title="{{ view_in_browser_label }}" style="color:#8A7884;text-decoration:underline;">{{ view_in_browser_label }}</a>.
      </td>
    </tr>
  </table>

  <!-- Main card -->
  <table role="presentation" class="em-container em-card" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">

    <!-- HOOK + greeting -->
    <tr>
      <td class="em-pad em-body-text em-text" style="padding:48px 44px 0 44px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">
        <p style="margin:0 0 22px 0;">Hoi Jaroslav,</p>

        <p style="margin:0 0 22px 0;">
          Vorige week zat ik tegenover een man van 47. Laten we hem <strong>Mark</strong> noemen. Hij kwam binnen, ging zitten, en zei letterlijk niets de eerste vier minuten.
        </p>

        <p style="margin:0 0 22px 0;">
          Toen begon hij te huilen. Niet luid. Stil. Het soort huilen dat <em style="font-style:italic;">je twaalf jaar lang opspaart.</em>
        </p>

        <p style="margin:0 0 22px 0;">
          Zijn vader was drie weken eerder overleden. En Mark had hem in al die jaren één keer gebeld. Eén keer.
        </p>

        <p style="margin:0 0 22px 0;">
          Dat ene telefoontje was vier jaar geleden. Een kort gesprek. Koel. Afstandelijk. Over wie de begrafenis van zijn tante moest regelen. Geen &ldquo;hoe gaat het.&rdquo; Geen &ldquo;sorry.&rdquo; Gewoon logistiek. En daarna &mdash; stilte.
        </p>
      </td>
    </tr>

    <!-- Pull quote -->
    <tr>
      <td class="em-pad" style="padding:10px 44px 10px 44px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="border-left:3px solid #C89BA5;padding:8px 0 8px 20px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;line-height:1.6;color:#3A2530;">
              &ldquo;Ik wachtte op het juiste moment, Joris. Twaalf jaar lang wachtte ik op het juiste moment.&rdquo;
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td class="em-pad em-body-text em-text" style="padding:10px 44px 0 44px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">
        <p style="margin:0 0 22px 0;font-size:24px;">😶</p>

        <p style="margin:0 0 22px 0;">
          Ze hadden ruzie gehad. Iets stoms &mdash; over geld, over een huis, over woorden die je nooit had moeten zeggen. Mark wilde bellen. Honderd keer pakte hij zijn telefoon. Honderd keer legde hij hem weer neer.
        </p>

        <p style="margin:0 0 22px 0;">
          Want het was nog niet het juiste moment. Hij wilde eerst <em style="font-style:italic;">klaar</em> zijn. Klaar met boos zijn. Klaar met gelijk willen hebben. Klaar met die knoop in zijn maag.
        </p>

        <p style="margin:0 0 22px 0;">
          En ik herken dat. Ik herken het pijnlijk goed. Want ik heb het ook gedaan. Jaren geleden. Met een vriend die ik bijna vijftien jaar niet had gesproken. Ik wachtte op het moment dat ik wist wat ik moest zeggen. Dat moment kwam nooit. Hij stierf aan een hartaanval, drieënveertig jaar oud. En ik bleef achter met een telefoon die ik nooit had gepakt.
        </p>

        <p style="margin:0 0 22px 0;">
          En toen ik daar tegenover hem zat, dacht ik: <span class="hl-yellow">we wachten allemaal op een moment dat nooit komt.</span>
        </p>

        <p style="margin:0 0 22px 0;">
          We wachten tot we ons sterk genoeg voelen om dat gesprek te voeren. Tot we klaar zijn om die brief te schrijven. Tot we genoeg hebben gemediteerd, gelezen, nagedacht. Tot het weer goed voelt.
        </p>

        <p style="margin:0 0 14px 0;">Maar zo werkt het niet. En in mijn boek schreef ik er dit over:</p>
      </td>
    </tr>

    <!-- Full quote block -->
    <tr>
      <td class="em-pad" style="padding:6px 44px 6px 44px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="background:#F4E8EE;border-left:3px solid #C89BA5;padding:22px 26px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;line-height:1.65;color:#2E1F25;">
              &ldquo;Het juiste moment is een mythe die we onszelf vertellen om de pijn van nu uit te stellen. Maar uitstel is geen vrede &mdash; het is alleen pijn met rente.&rdquo;
              <br><br>
              <span style="font-size:13px;font-style:normal;color:#9C6B74;letter-spacing:1px;text-transform:uppercase;">— uit Laat los wat je kapotmaakt</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Teaching -->
    <tr>
      <td class="em-pad em-body-text em-text" style="padding:10px 44px 0 44px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">
        <p style="margin:0 0 18px 0;">Mark en ik werkten daarna aan <strong>twee dingen</strong>. Ik geef ze hier ook aan jou:</p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px 0;">
          <tr>
            <td width="34" valign="top" style="padding:0 12px 0 0;">
              <div style="width:30px;height:30px;line-height:30px;text-align:center;background:#1F1B16;color:#FFFFFF;border-radius:50%;font-family:Georgia,serif;font-size:15px;font-weight:700;">1</div>
            </td>
            <td valign="top" style="padding-top:4px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">
              <strong>Schrijf het op &mdash; vandaag, niet morgen.</strong><br>
              Pak een vel papier. Schrijf wat je zou willen zeggen. Tegen wie. Niet om te versturen. Om te <em style="font-style:italic;">zien.</em> Want zolang het in je hoofd zit, blijft het groeien.
            </td>
          </tr>
          <tr><td colspan="2" style="height:18px;line-height:18px;">&nbsp;</td></tr>
          <tr>
            <td width="34" valign="top" style="padding:0 12px 0 0;">
              <div style="width:30px;height:30px;line-height:30px;text-align:center;background:#1F1B16;color:#FFFFFF;border-radius:50%;font-family:Georgia,serif;font-size:15px;font-weight:700;">2</div>
            </td>
            <td valign="top" style="padding-top:4px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">
              <strong>Bel binnen 48 uur.</strong><br>
              Niet als je &ldquo;klaar&rdquo; bent. Niet als de woorden perfect zijn. Bel als je trilt. Bel als je niet weet wat je moet zeggen. <em style="font-style:italic;">Klaar zijn komt nooit. Bellen wel.</em>
            </td>
          </tr>
        </table>

        <p style="margin:22px 0 22px 0;">Mark belde zijn moeder de avond na ons gesprek. Voor het eerst in vier jaar.</p>

        <p style="margin:0 0 22px 0;">
          Hij vertelde me later: <span class="hl-yellow">&ldquo;Ik dacht dat ik de woorden moest hebben. Ik had ze niet. Maar ze huilde mee. En dat was genoeg.&rdquo;</span>
        </p>

        <p style="margin:0 0 22px 0;">
          Voor zijn vader was hij te laat. Voor zijn moeder niet. Soms is dat het verschil tussen een leven met spijt en een leven zonder.
        </p>

        <p style="margin:0 0 22px 0;">
          En misschien lees jij dit nu en denk je aan iemand. Een vader. Een zus. Een vriendin van vroeger. Iemand met wie je iets onafgemaakts hebt.
        </p>

        <p style="margin:0 0 22px 0;">
          <em style="font-style:italic;">Wacht niet op het juiste moment.</em> Het juiste moment is een leugen die je aan jezelf vertelt om de pijn van nu te vermijden. Maar die pijn van nu is altijd kleiner dan de pijn van te laat.
        </p>

        <p style="margin:0 0 22px 0;">
          Ik weet dat dit confronterend is. Dat ook jij misschien nu aan iemand denkt terwijl je dit leest. Een ouder. Een broer. Een vriendin met wie je bent opgehouden te praten. Iemand bij wie het gesprek al jaren onaf is. En ik wil je niet pushen. Ik wil je alleen maar vragen: hoeveel verliezen heb je nodig voor je het pakt?
        </p>

        <p style="margin:0 0 22px 0;">
          In <em style="font-style:italic;">Laat los wat je kapotmaakt</em> ga ik dieper in op precies dit &mdash; waarom we vasthouden aan dingen die ons stuk maken, en hoe we ze één voor één kunnen neerleggen. Mark las het in een week. Hij zei dat het hem misschien nog wel zijn moeder gaf terug.
        </p>
      </td>
    </tr>

    <!-- CTA #1 -->
    <tr>
      <td class="em-pad" align="center" style="padding:14px 44px 10px 44px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
          <tr>
            <td align="center" style="border-radius:4px;background:#1F1B16;">
              <a href="https://loslatenboek.nl" class="em-cta" title="Bekijk Laat los wat je kapotmaakt op loslatenboek.nl" style="display:inline-block;padding:18px 38px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.3px;color:#FFFFFF;text-decoration:none;border-radius:4px;">
                Bekijk het boek&nbsp;&rarr;
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0 0;font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px;color:#8A7884;">
          loslatenboek.nl
        </p>
      </td>
    </tr>

    <!-- Closing -->
    <tr>
      <td class="em-pad em-body-text em-text" style="padding:18px 44px 0 44px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">
        <p style="margin:0 0 22px 0;">
          Maar als je het boek niet leest &mdash; doe dan dit ene ding: <strong>denk vandaag aan die ene persoon.</strong> En bel.
        </p>

        <p style="margin:0 0 26px 0;">
          Want het juiste moment komt niet. <span class="hl-yellow">Jij bent het juiste moment.</span>
        </p>
      </td>
    </tr>

    <!-- Signature -->
    <tr>
      <td class="em-pad" style="padding:6px 44px 22px 44px;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#1F1B16;">
        <p style="margin:0;font-style:italic;font-family:Georgia,serif;font-size:20px;">Joris</p>
      </td>
    </tr>

    <!-- P.S. + P.P.S. -->
    <tr>
      <td class="em-pad" style="padding:8px 44px 36px 44px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="border-top:1px dashed #E8D7DE;padding-top:22px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65;color:#3A2D33;">
              <p style="margin:0 0 14px 0;">
                <strong style="letter-spacing:0.5px;">P.S.</strong>&nbsp;&nbsp;Mark zei me iets dat ik niet vergeet: <em style="font-style:italic;">&ldquo;Ik dacht dat tijd mijn vriend was. Hij was mijn schuldeiser.&rdquo;</em> Hoeveel tijd heb jij geleend bij iemand om wie je geeft &mdash; en nog niet teruggegeven?
              </p>
              <p style="margin:0;font-style:italic;">
                <strong style="font-style:normal;letter-spacing:0.5px;">P.P.S.</strong>&nbsp;&nbsp;Aan wie dacht jij toen je dit las? Antwoord me &mdash; één naam is genoeg. Ik lees alles. 💭
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table><!-- /Main card -->

  <!-- Secondary CTA -->
  <table role="presentation" class="em-container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;margin-top:22px;">
    <tr>
      <td align="center" style="padding:0 8px;">
        <a href="https://loslatenboek.nl" title="Bekijk Laat los wat je kapotmaakt op loslatenboek.nl" style="display:inline-block;font-family:-apple-system,'Segoe UI',sans-serif;font-size:14px;color:#8C2E54;text-decoration:underline;letter-spacing:0.3px;">
          Bekijk Laat los wat je kapotmaakt →
        </a>
      </td>
    </tr>
  </table>

</td>
</tr>
</table>

</div><!-- /role=article -->

</body>
</html>
`
