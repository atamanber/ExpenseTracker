const FILE_ID_KEY = 'gdrive-file-id'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FILENAME = 'expense-tracker-backup.json'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function getToken(clientId: string): Promise<string> {
  await loadScript('https://accounts.google.com/gsi/client')
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.error || !resp.access_token) reject(new Error(resp.error ?? 'No token'))
        else resolve(resp.access_token)
      },
    })
    client.requestAccessToken()
  })
}

export async function saveToDrive(clientId: string, data: object): Promise<void> {
  const token = await getToken(clientId)
  const body = JSON.stringify(data, null, 2)
  const blob = new Blob([body], { type: 'application/json' })
  const existingId = localStorage.getItem(FILE_ID_KEY)

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: blob }
    )
    if (res.ok) return
    // File deleted on Drive side — fall through to create
    localStorage.removeItem(FILE_ID_KEY)
  }

  // Create new file (multipart: metadata + content)
  const meta = JSON.stringify({ name: FILENAME, mimeType: 'application/json' })
  const boundary = 'drive_boundary_' + Math.random().toString(36).slice(2)
  const multipart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    meta,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    body,
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  })
  if (!res.ok) throw new Error(`Drive create failed: ${res.status} ${await res.text()}`)
  const { id } = await res.json() as { id: string }
  localStorage.setItem(FILE_ID_KEY, id)
}

export async function loadFromDrive(clientId: string): Promise<object> {
  const fileId = localStorage.getItem(FILE_ID_KEY)
  if (!fileId) throw new Error('No Drive file linked. Save to Drive first to link a file.')
  const token = await getToken(clientId)
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Drive load failed: ${res.status}`)
  return res.json() as Promise<object>
}
