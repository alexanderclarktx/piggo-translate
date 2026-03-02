const dbName = "piggo-translate"
const dbVersion = 1
const storeName = "settings"
const targetLanguageKey = "targetLanguage"

const getDatabase = () => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve<IDBDatabase | null>(null)
  }

  return new Promise<IDBDatabase | null>((resolve) => {
    const request = window.indexedDB.open(dbName, dbVersion)

    request.onerror = () => {
      resolve(null)
    }

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

export const readTargetLanguage = async () => {
  const database = await getDatabase()

  if (!database) {
    return null
  }

  return new Promise<string | null>((resolve) => {
    const transaction = database.transaction(storeName, "readonly")
    const store = transaction.objectStore(storeName)
    const request = store.get(targetLanguageKey)

    request.onerror = () => {
      resolve(null)
    }

    request.onsuccess = () => {
      const value = request.result
      resolve(typeof value === "string" ? value : null)
    }

    transaction.oncomplete = () => {
      database.close()
    }

    transaction.onerror = () => {
      database.close()
    }
  })
}

export const writeTargetLanguage = async (targetLanguage: string) => {
  if (!targetLanguage.trim()) {
    return
  }

  const database = await getDatabase()

  if (!database) {
    return
  }

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(storeName, "readwrite")
    const store = transaction.objectStore(storeName)
    store.put(targetLanguage, targetLanguageKey)

    transaction.oncomplete = () => {
      resolve()
    }

    transaction.onerror = () => {
      resolve()
    }
  })

  database.close()
}
