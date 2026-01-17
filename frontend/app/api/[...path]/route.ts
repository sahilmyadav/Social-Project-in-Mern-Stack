import { NextRequest, NextResponse } from 'next/server';

// Backend URL - use internal Docker network URL in production
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3333';

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/');
  const url = new URL(request.url);
  const targetUrl = `${BACKEND_URL}/api/${path}${url.search}`;

  try {
    // Get headers from the original request
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      // Skip headers that shouldn't be forwarded
      if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    // Forward the request to the backend
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    // Add body for non-GET requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = request.headers.get('content-type') || '';

      if (contentType.includes('multipart/form-data')) {
        // For file uploads, pass the body as-is
        fetchOptions.body = await request.arrayBuffer();
        // Keep the original content-type with boundary
        headers['content-type'] = contentType;
      } else if (contentType.includes('application/json')) {
        fetchOptions.body = await request.text();
      } else {
        fetchOptions.body = await request.text();
      }
    }

    fetchOptions.headers = headers;

    const response = await fetch(targetUrl, fetchOptions);

    // Get response body
    const responseData = await response.arrayBuffer();

    // Create response with same status and headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to connect to backend' },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}
