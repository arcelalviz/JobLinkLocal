import Image from 'next/image';

export function BrandMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return <Image src="/images/joblinklocal-icon.png" alt="JobLinkLocal" width={size} height={size} className={className} priority />;
}
