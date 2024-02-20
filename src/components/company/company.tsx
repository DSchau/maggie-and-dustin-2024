import type { ImageMetadata } from "astro";

interface Props {
  name: string;
  logo?: ImageMetadata;
}

export function Company({ name, logo }: Props) {
  return (
    <>
      {logo?.src && <img src={logo.src} alt={`Logo for ${name}`} style={{
        display: 'inline-block',
        verticalAlign: 'middle'
      }}/>}
      <span className={name.replace(/\s/g, '-').toLowerCase()}>{name}</span>
    </>
  )
}
