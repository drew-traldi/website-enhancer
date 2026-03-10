import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile } from 'fs/promises'
import path from 'path'

const TEMPLATE_PATH = path.join(process.cwd(), 'data', 'email-template.txt')

export async function GET() {
  try {
    const template = await readFile(TEMPLATE_PATH, 'utf-8')
    return NextResponse.json({ template })
  } catch {
    return NextResponse.json({ template: '' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { template } = await req.json()
    if (typeof template !== 'string') {
      return NextResponse.json({ error: 'Invalid template' }, { status: 400 })
    }
    const dir = path.dirname(TEMPLATE_PATH)
    const { mkdir } = await import('fs/promises')
    await mkdir(dir, { recursive: true })
    await writeFile(TEMPLATE_PATH, template, 'utf-8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
