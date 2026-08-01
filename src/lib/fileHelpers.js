// File name ko URL-safe banata hai — spaces, colons, special characters ko underscore se replace karta hai
// Isse Supabase Storage upload fail nahi hota (jaise "Chauhan 2.png" → "Chauhan_2.png")
export function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-]/g, '_')
}