import { apiApp } from '../server/api.ts'

const handleRequest = (request: Request) => apiApp.fetch(request)

export const GET = handleRequest
export const POST = handleRequest
export const PUT = handleRequest
export const DELETE = handleRequest
export const PATCH = handleRequest
export const OPTIONS = handleRequest
