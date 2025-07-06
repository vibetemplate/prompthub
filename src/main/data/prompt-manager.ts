import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'

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

export class PromptManager {
  private dataPath: string
  private prompts: PromptNode[] = []

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'prompts.json')
    this.loadPrompts()
  }

  private async loadPrompts(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8')
      this.prompts = JSON.parse(data)
    } catch (error) {
      // 文件不存在或格式错误，使用默认数据
      this.prompts = this.getDefaultPrompts()
      await this.savePrompts()
    }
  }

  private async savePrompts(): Promise<void> {
    await fs.writeFile(this.dataPath, JSON.stringify(this.prompts, null, 2))
  }

  private getDefaultPrompts(): PromptNode[] {
    return [
      {
        id: 'default-folder',
        title: '默认提示词',
        type: 'folder',
        children: [
          {
            id: 'welcome-prompt',
            title: '欢迎提示词',
            type: 'prompt',
            parentId: 'default-folder',
            content: '你好！请帮我...',
            tags: ['示例'],
            websiteType: 'deepseek',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ]
  }

  async getAll(): Promise<PromptNode[]> {
    return this.prompts
  }

  async create(prompt: Partial<PromptNode>): Promise<PromptNode> {
    const newPrompt: PromptNode = {
      id: uuidv4(),
      title: prompt.title || '新提示词',
      type: prompt.type || 'prompt',
      parentId: prompt.parentId,
      content: prompt.content || '',
      tags: prompt.tags || [],
      websiteType: prompt.websiteType || 'deepseek',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    if (prompt.parentId) {
      // 添加到父节点的children中
      const parent = this.findNodeById(prompt.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(newPrompt)
      }
    } else {
      // 作为根节点添加
      this.prompts.push(newPrompt)
    }

    await this.savePrompts()
    return newPrompt
  }

  async update(id: string, updates: Partial<PromptNode>): Promise<PromptNode | null> {
    const prompt = this.findNodeById(id)
    if (!prompt) {
      return null
    }

    Object.assign(prompt, updates, { updatedAt: new Date() })
    await this.savePrompts()
    return prompt
  }

  async delete(id: string): Promise<void> {
    const prompt = this.findNodeById(id)
    if (!prompt) {
      return
    }

    if (prompt.parentId) {
      const parent = this.findNodeById(prompt.parentId)
      if (parent && parent.children) {
        parent.children = parent.children.filter(child => child.id !== id)
      }
    } else {
      this.prompts = this.prompts.filter(p => p.id !== id)
    }

    await this.savePrompts()
  }

  async import(filePath: string): Promise<PromptNode[]> {
    const data = await fs.readFile(filePath, 'utf-8')
    const importedPrompts: PromptNode[] = JSON.parse(data)
    
    // 为导入的提示词生成新ID
    const processPrompts = (prompts: PromptNode[]): PromptNode[] => {
      return prompts.map(prompt => ({
        ...prompt,
        id: uuidv4(),
        children: prompt.children ? processPrompts(prompt.children) : undefined,
      }))
    }

    const newPrompts = processPrompts(importedPrompts)
    this.prompts.push(...newPrompts)
    await this.savePrompts()
    return newPrompts
  }

  async export(filePath: string, prompts: PromptNode[]): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(prompts, null, 2))
  }

  private findNodeById(id: string): PromptNode | null {
    const search = (nodes: PromptNode[]): PromptNode | null => {
      for (const node of nodes) {
        if (node.id === id) {
          return node
        }
        if (node.children) {
          const found = search(node.children)
          if (found) {
            return found
          }
        }
      }
      return null
    }

    return search(this.prompts)
  }
}