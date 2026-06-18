// 统一的细线图标集 —— 零依赖，全部 24×24 viewBox，1.4 描边、圆角、currentColor。
// stroke / strokeWidth / linecap 设在 <svg> 上，子元素继承，所以每个图标只写 d。

export type IconName =
  | 'home' | 'chat' | 'memories' | 'snippets' | 'letters'
  | 'diary' | 'reminders' | 'tokens' | 'persona' | 'ombre'

const PATHS: Record<IconName, React.ReactNode> = {
  home: <><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /></>,
  chat: <><path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V15.5H5A1.5 1.5 0 0 1 3.5 14V6A1.5 1.5 0 0 1 5 4.5Z" /></>,
  memories: <><path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z" /><path d="M3.5 13 12 17.5 20.5 13" /></>,
  snippets: <><path d="M6.5 4h11v16l-5.5-3.8L6.5 20V4Z" /></>,
  letters: <><path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" /><path d="M3.5 7.2 12 13l8.5-5.8" /></>,
  diary: <><path d="M6.5 3.5H17a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5V3.5Z" /><path d="M6.5 3.5v17" /><path d="M9.5 8h5M9.5 11.5h5" /></>,
  reminders: <><path d="M12 4a5 5 0 0 0-5 5v3.5L5.2 16h13.6L17 12.5V9a5 5 0 0 0-5-5Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  tokens: <><path d="M3 13h3.5l2-6 3.5 11 2.2-7 1.3 2H21" /></>,
  persona: <><path d="M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
  ombre: <><path d="M12 3.2 19.5 7.6v8.8L12 20.8 4.5 16.4V7.6L12 3.2Z" /></>,
}

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
    >
      {PATHS[name]}
    </svg>
  )
}
