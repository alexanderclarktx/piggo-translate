export const isMobile = (): boolean => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export const isLocal = (): boolean => window.location.hostname === 'localhost'
