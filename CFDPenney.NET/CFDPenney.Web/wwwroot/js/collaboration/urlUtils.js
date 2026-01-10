// URL Query Parameter Management
export function updateURLWithCode(code) {
    if (!code) return;
    const url = new URL(window.location.href);
    url.searchParams.set('code', code);
    window.history.replaceState({}, '', url);
}

export function removeCodeFromURL() {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url);
}

export function getCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    return code ? code.trim().toUpperCase() : null;
}

export function getShareableURL(code) {
    if (!code) return null;
    const url = new URL(window.location.href);
    url.searchParams.set('code', code);
    return url.toString();
}

