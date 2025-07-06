import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface PromptNode {
  id: string
  title: string
  type: 'folder' | 'prompt'
  parentId?: string
  children?: PromptNode[]
  // 仅对prompt类型有效
  content?: string
  tags?: string[]
  websiteType?: 'deepseek' | 'chatgpt' | 'claude' | 'gemini' | 'kimi' | 'tongyi'
  createdAt?: Date
  updatedAt?: Date
}

interface PromptState {
  prompts: PromptNode[]
  selectedPrompt: PromptNode | null
  isLoading: boolean
  error: string | null
}

interface PromptActions {
  loadPrompts: () => Promise<void>
  createPrompt: (prompt: Partial<PromptNode>) => Promise<void>
  updatePrompt: (id: string, updates: Partial<PromptNode>) => Promise<void>
  deletePrompt: (id: string) => Promise<void>
  selectPrompt: (prompt: PromptNode | null) => void
  importPrompts: (filePath: string) => Promise<void>
  exportPrompts: (filePath: string, prompts: PromptNode[]) => Promise<void>
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
}

export const usePromptStore = create<PromptState & PromptActions>()(
  immer((set, get) => ({
    prompts: [],
    selectedPrompt: null,
    isLoading: false,
    error: null,

    loadPrompts: async () => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        const prompts = await window.electronAPI.prompts.getAll()
        
        set((state) => {
          state.prompts = prompts
          state.isLoading = false
        })
      } catch (error) {
        console.error('Failed to load prompts:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to load prompts'
          state.isLoading = false
        })
      }
    },

    createPrompt: async (prompt: Partial<PromptNode>) => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        const newPrompt = await window.electronAPI.prompts.create(prompt)
        
        set((state) => {
          // 找到父节点并添加到children中，或添加到根节点
          if (prompt.parentId) {
            const findAndAddToParent = (nodes: PromptNode[]): boolean => {
              for (const node of nodes) {
                if (node.id === prompt.parentId) {
                  node.children = node.children || []
                  node.children.push(newPrompt)
                  return true
                }
                if (node.children && findAndAddToParent(node.children)) {
                  return true
                }
              }
              return false
            }
            findAndAddToParent(state.prompts)
          } else {
            state.prompts.push(newPrompt)
          }
          
          state.isLoading = false
        })
      } catch (error) {
        console.error('Failed to create prompt:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to create prompt'
          state.isLoading = false
        })
      }
    },

    updatePrompt: async (id: string, updates: Partial<PromptNode>) => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        const updatedPrompt = await window.electronAPI.prompts.update(id, updates)
        
        if (updatedPrompt) {
          set((state) => {
            const findAndUpdate = (nodes: PromptNode[]): boolean => {
              for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === id) {
                  nodes[i] = updatedPrompt
                  return true
                }
                if (nodes[i].children && findAndUpdate(nodes[i].children!)) {
                  return true
                }
              }
              return false
            }
            findAndUpdate(state.prompts)
            
            // 如果当前选中的是这个prompt，也要更新
            if (state.selectedPrompt?.id === id) {
              state.selectedPrompt = updatedPrompt
            }
            
            state.isLoading = false
          })
        }
      } catch (error) {
        console.error('Failed to update prompt:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to update prompt'
          state.isLoading = false
        })
      }
    },

    deletePrompt: async (id: string) => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        await window.electronAPI.prompts.delete(id)
        
        set((state) => {
          const findAndDelete = (nodes: PromptNode[]): boolean => {
            for (let i = 0; i < nodes.length; i++) {
              if (nodes[i].id === id) {
                nodes.splice(i, 1)
                return true
              }
              if (nodes[i].children && findAndDelete(nodes[i].children!)) {
                return true
              }
            }
            return false
          }
          findAndDelete(state.prompts)
          
          // 如果删除的是当前选中的prompt，清空选中状态
          if (state.selectedPrompt?.id === id) {
            state.selectedPrompt = null
          }
          
          state.isLoading = false
        })
      } catch (error) {
        console.error('Failed to delete prompt:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to delete prompt'
          state.isLoading = false
        })
      }
    },

    selectPrompt: (prompt: PromptNode | null) => {
      set((state) => {
        state.selectedPrompt = prompt
      })
    },

    importPrompts: async (filePath: string) => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        const importedPrompts = await window.electronAPI.prompts.import(filePath)
        
        set((state) => {
          state.prompts.push(...importedPrompts)
          state.isLoading = false
        })
      } catch (error) {
        console.error('Failed to import prompts:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to import prompts'
          state.isLoading = false
        })
      }
    },

    exportPrompts: async (filePath: string, prompts: PromptNode[]) => {
      try {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        
        await window.electronAPI.prompts.export(filePath, prompts)
        
        set((state) => {
          state.isLoading = false
        })
      } catch (error) {
        console.error('Failed to export prompts:', error)
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to export prompts'
          state.isLoading = false
        })
      }
    },

    setError: (error: string | null) => {
      set((state) => {
        state.error = error
      })
    },

    setLoading: (loading: boolean) => {
      set((state) => {
        state.isLoading = loading
      })
    },
  }))
)