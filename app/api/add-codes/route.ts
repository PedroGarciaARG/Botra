import { NextResponse } from 'next/server'
import { addCodes } from '@/lib/google-sheets'

export async function POST(request: Request) {
  try {
    const { sheetName, codes } = await request.json()
    
    if (!sheetName || !codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'sheetName y codes son requeridos' }, { status: 400 })
    }
    
    // Filtrar códigos vacíos y limpiar espacios
    const cleanedCodes = codes
      .map((code: string) => code.trim())
      .filter((code: string) => code.length > 0)
    
    if (cleanedCodes.length === 0) {
      return NextResponse.json({ error: 'No hay códigos válidos para agregar' }, { status: 400 })
    }
    
    const result = await addCodes(sheetName, cleanedCodes)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error adding codes:', error)
    return NextResponse.json({ error: 'Error al agregar códigos' }, { status: 500 })
  }
}
