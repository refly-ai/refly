import tailwindNesting from "tailwindcss/nesting"
import tailwind from "tailwindcss"
import autoprefixer from "autoprefixer"
import { Plugin, Processor } from "postcss"
import tailwindConfig from "./tailwind.config"

const config: { plugins: (Plugin | Processor)[] } = {
  plugins: [tailwindNesting, tailwind(tailwindConfig), autoprefixer()],
}

export default config
