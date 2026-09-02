import Image from "next/image"

type BrandLogoProps = {
  size?: number
  className?: string
}

export function BrandLogo({ size = 40, className = "" }: BrandLogoProps) {
  return (
    <Image
      src="/brand/Bearfit-Logo-v2.png"
      alt="Bearfit Logo"
      width={size}
      height={size}
      priority
      className={`object-contain ${className}`}
    />
  )
}
