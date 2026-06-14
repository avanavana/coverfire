import React from 'react'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  color?: string
  size?: number
}

const LinkedIn: React.FC<IconProps> = ({ className, color, size = 64, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <path d="M63.9 4.6V59.3C63.9 61.84 61.85 63.9 59.34 63.9H4.55C2.04 63.9 0 61.83 0 59.3V4.6C0 2.07 2.04 0 4.55 0H59.34C61.85 0 63.9 2.07 63.9 4.6ZM20.07 14.62C20.07 11.59 17.6 9.13 14.58 9.13C11.56 9.13 9.09 11.59 9.09 14.62C9.09 17.65 11.54 20.11 14.58 20.11C17.62 20.11 20.07 17.65 20.07 14.62ZM19.33 54.78V24.29H9.84V54.78H19.33ZM54.81 38.05C54.81 29.84 53.03 23.52 43.45 23.52C38.84 23.52 35.75 26.05 34.48 28.44H34.35V24.28H25.27V54.77H34.74V39.68C34.74 35.69 35.49 31.84 40.43 31.84C45.37 31.84 45.35 36.4 45.35 39.93V54.76H54.82V38.04L54.81 38.05Z" fill={color || 'currentColor'}/>
  </svg>
)

LinkedIn.displayName = 'LinkedInIcon'

export default LinkedIn