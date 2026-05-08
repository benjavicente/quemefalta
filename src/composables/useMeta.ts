import { onMounted, onUnmounted, watch, isRef, type Ref } from 'vue';

interface MetaTags {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

const DEFAULTS: Required<MetaTags> = {
  title: 'QueMeFalta — Álbum del Mundial 2026',
  description:
    'Marca tus láminas del Mundial 2026, identifica las que te faltan y comparte tu progreso.',
  ogTitle: 'QueMeFalta — El Álbum del Mundial 2026',
  ogDescription: 'Marca tus láminas, identifica las que faltan, comparte tu progreso.',
  ogImage: 'https://quemefalta.vercel.app/og-image.png',
};

function setMetaTag(property: string, content: string, attr: 'name' | 'property' = 'name') {
  let tag = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, property);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

export function useMeta(meta: MetaTags | Ref<MetaTags>) {
  const apply = (m: MetaTags) => {
    const merged = { ...DEFAULTS, ...m };
    document.title = merged.title;
    setMetaTag('description', merged.description);
    setMetaTag('og:title', merged.ogTitle, 'property');
    setMetaTag('og:description', merged.ogDescription, 'property');
    setMetaTag('og:image', merged.ogImage, 'property');
    setMetaTag('twitter:title', merged.ogTitle);
    setMetaTag('twitter:description', merged.ogDescription);
    setMetaTag('twitter:image', merged.ogImage);
  };

  if (isRef(meta)) {
    watch(meta, (m) => apply(m), { immediate: true });
  } else {
    onMounted(() => apply(meta));
  }

  onUnmounted(() => apply({}));
}
