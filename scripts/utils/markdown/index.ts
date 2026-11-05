import type { Translate } from './shared'
import { stepsPlugin } from './steps'
import { fileTreePlugin } from './file-tree'
import { fieldPlugin } from './field'
import { gridPlugin } from './grid'
import { notesPlugin } from './notes'
import { githubPlugin } from './github'
import { mermaidPlugin } from './mermaid'
import { codeTreePlugin, type CodeTreeOptions } from './code-tree'

export type { Translate, CodeTreeOptions }

export function markdownExtensions(md: any, t: Translate, options: CodeTreeOptions = {}) {
  stepsPlugin(md, t)
  fileTreePlugin(md, t)
  fieldPlugin(md, t)
  gridPlugin(md)
  notesPlugin(md, t)
  githubPlugin(md, t)
  mermaidPlugin(md, t)
  // Registered last so its core rule runs first and claims the fences inside `:::code-tree`.
  codeTreePlugin(md, t, options)
  return md
}
