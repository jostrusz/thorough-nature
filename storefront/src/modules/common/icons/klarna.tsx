import React from "react"

import { IconProps } from "types/icon"

const Klarna: React.FC<IconProps> = ({
  size = "20",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width="20px"
      height="20px"
      viewBox="0 0 24 24"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      {...attributes}
    >
      <title>Klarna icon</title>
      <path d="M4.592 2H0v20h4.592c0-4.18 1.63-8.085 4.592-11.04V2H4.592zM13.753 2a16.108 16.108 0 0 0-4.748 11.394c0 3.362 1.024 6.478 2.778 9.076l1.97 1.53h3.09L15.36 22.07a14.156 14.156 0 0 1-2.406-7.87l.014-.806A14.175 14.175 0 0 1 15.36 5.93L16.844 4h-3.09V2zm7.578 16.4a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z" />
    </svg>
  )
}

export default Klarna
