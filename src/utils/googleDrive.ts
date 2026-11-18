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
      error_callback: (err: { type?: string }) => {
        reject(new Error(err.type === 'popup_closed' ? 'Google sign-in was cancelled.' : `Google sign-in failed: ${err.type ?? 'unknown'}`))
      },
    })
    client.requestAccessToken()
  })
}

// drive.file only exposes files created by this OAuth client, so a name lookup is safe
// and lets a fresh browser find the existing backup instead of creating a duplicate.
async function findBackupId(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILENAME}' and trashed=false`)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Drive lookup failed: ${res.status} ${await res.text()}`)
  const { files } = await res.json() as { files: { id: string }[] }
  return files[0]?.id ?? null
}

async function resolveFileId(token: string): Promise<string | null> {
  const stored = localStorage.getItem(FILE_ID_KEY)
  if (stored) return stored
  const found = await findBackupId(token)
  if (found) localStorage.setItem(FILE_ID_KEY, found)
  return found
}

export async function saveToDrive(clientId: string, data: object): Promise<void> {
  const token = await getToken(clientId)
  const body = JSON.stringify(data, null, 2)
  const existingId = await resolveFileId(token)

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body }
    )
    if (res.ok) return
    if (res.status !== 404) throw new Error(`Drive update failed: ${res.status} ${await res.text()}`)
    // File was deleted on Drive — forget the stale ID and create a fresh one below
    localStorage.removeItem(FILE_ID_KEY)
  }

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
  const token = await getToken(clientId)
  const fileId = await resolveFileId(token)
  if (!fileId) throw new Error('No backup found on Drive. Use Save to Drive first.')
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) {
    localStorage.removeItem(FILE_ID_KEY)
    throw new Error('The linked backup file no longer exists on Drive. Click Load again to search for another, or Save to create a new one.')
  }
  if (!res.ok) throw new Error(`Drive load failed: ${res.status}`)
  return res.json() as Promise<object>
}
