declare module 'lucide-react/dist/esm/icons/*' {
  import { FC, SVGProps } from 'react'
  
  export interface LucideProps extends Partial<Omit<SVGProps<SVGSVGElement>, 'ref'>> {
    size?: string | number
    absoluteStrokeWidth?: boolean
  }

  const Icon: FC<any>
  export default Icon
}
