// Turns an uploaded study document into plain text for the AI.
// PDF, DOCX and PPTX go through officeparser.
import { OfficeParser } from 'officeparser'

export const ACCEPTED_TYPES = ['pdf', 'pptx', 'docx']

export const extOf = (name = '') => name.split('.').pop().toLowerCase()

// Throws an Error with a user-facing message when the file can't be read
export async function extractText(buffer, filename) {
  const ext = extOf(filename)
  let text
  try {
    const ast = await OfficeParser.parseOffice(buffer, { fileType: ext })
    text = (await ast.to('text', { textConfig: { preserveLayout: false } })).value
  } catch {
    throw new Error(`We couldn't read ${filename}. Check that the file isn't damaged or password-protected.`)
  }
  // collapse the extra spaces and blank lines PDFs and slides leave behind
  return text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim()
}
