import { DefaultChatTransport } from 'ai'

type CustomChatTransportOptions = {
  api?: string
  headers?: Record<string, string> | Headers
  credentials?: RequestCredentials
  fetch?: typeof fetch
  // เพิ่ม callback ของเราเอง
  onResponse: (response: Response) => void
}

export const createCustomChatTransport = ({
  onResponse,
  ...options
}: CustomChatTransportOptions) => {
  const originalFetch = options.fetch ?? fetch;

  const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    
    // เรียก callback ของเราพร้อมกับ response ที่ได้
    onResponse(response.clone()) // ใช้ .clone() เพื่อให้ stream ยังอ่านต่อได้

    return response;
  };

  return new DefaultChatTransport({
    ...options,
    fetch: customFetch,
  })
}