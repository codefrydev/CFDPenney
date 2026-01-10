// File Upload Module
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function handleFileSelect(fileInput, onFileSelected) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        return null;
    }
    
    const file = fileInput.files[0];
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        alert(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit. Please choose a smaller file.`);
        fileInput.value = '';
        return null;
    }
    
    if (onFileSelected) {
        onFileSelected(file);
    }
    
    return file;
}

export function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve({
                data: reader.result,
                name: file.name,
                type: file.type,
                size: file.size
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function updateFilePreview(file, previewContainer, fileNameEl, fileSizeEl, previewImgEl) {
    if (!file) {
        if (previewContainer) previewContainer.classList.add('hidden');
        if (previewImgEl) previewImgEl.classList.add('hidden');
        return;
    }
    
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    
    // Show image preview if it's an image
    if (file.type.startsWith('image/') && previewImgEl) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImgEl.src = e.target.result;
            previewImgEl.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else if (previewImgEl) {
        previewImgEl.classList.add('hidden');
    }
}

export function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) {
        return 'image';
    } else if (fileType.includes('pdf')) {
        return 'file-text';
    } else if (fileType.includes('word') || fileType.includes('document')) {
        return 'file-text';
    } else {
        return 'file';
    }
}

export function downloadFile(fileData, fileName) {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName || 'file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
