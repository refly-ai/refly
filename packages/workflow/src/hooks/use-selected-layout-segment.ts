import { useLocation } from "react-router-dom"

// 自定义 hook 来模拟 useSelectedLayoutSegment
export function useSelectedLayoutSegment() {
  const location = useLocation()
  const segments = location.pathname.split("/").filter(Boolean)
  return segments[1] || null // 假设我们关注的是 URL 的第二个段
}

export function useSelectedLayoutSegments() {
  const location = useLocation()
  return location.pathname.split("/").filter(Boolean)
}
