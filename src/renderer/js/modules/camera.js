/**
 * Kamera İşlevselliği Modülü - Electron Versiyonu
 */
const CameraModule = (function() {
    // Özel değişkenler
    let photoVideo = null;
    let realtimeVideo = null;
    let photoCanvas = null;
    let resultImage = null;
    let uploadedImage = null;
    let photoStreaming = false;
    let realtimeStreaming = false;
    let imageAnalysisCallback = null;
    let currentTab = 'photo'; // 'photo', 'upload', 'realtime'
    let fileInput = null;
    let currentConstraints = {}; // Kamera kısıtlamaları

    /**
     * Modülü başlatır ve gerekli DOM elementlerini yapılandırır
     * @param {Function} onImageAnalysis - Resim analizi için callback fonksiyonu
     * @returns {boolean} - Başlatma başarılı mı?
     */
    const init = async (onImageAnalysis = null) => {
        // Gerekli DOM elementlerini tanımla ve kontrol et
        const requiredElements = [
            { id: 'photoVideo', variable: 'photoVideo', critical: true },
            { id: 'realtimeVideo', variable: 'realtimeVideo', critical: true },
            { id: 'photoCanvas', variable: 'photoCanvas', critical: true },
            { id: 'resultImage', variable: 'resultImage', critical: true },
            { id: 'uploadedImage', variable: 'uploadedImage', critical: false },
            { id: 'fileInput', variable: 'fileInput', critical: false },
            { id: 'takePhotoTab', variable: null, critical: true },
            { id: 'uploadImageTab', variable: null, critical: true },
            { id: 'realTimeTab', variable: null, critical: true },
            { id: 'photoTabContent', variable: null, critical: true },
            { id: 'uploadTabContent', variable: null, critical: true },
            { id: 'realtimeTabContent', variable: null, critical: true },
            { id: 'resultSection', variable: null, critical: true }
        ];

        // Elementlerin varlığını kontrol et
        let missingCriticalElements = false;
        const missingElements = [];

        for (const element of requiredElements) {
            const domElement = document.getElementById(element.id);
            
            if (!domElement) {
                missingElements.push(element.id);
                if (element.critical) {
                    missingCriticalElements = true;
                    console.error(`Kritik DOM elementi eksik: #${element.id}`);
                } else {
                    console.warn(`İsteğe bağlı DOM elementi eksik: #${element.id}`);
                }
            } else if (element.variable) {
                // Global değişkene ata
                window[element.variable] = domElement;
            }
        }

        // Kritik elementler eksikse modülü başlatma
        if (missingCriticalElements) {
            console.error('Kamera modülü başlatılamadı: Kritik DOM elementleri eksik:', 
                missingElements.filter(id => 
                    requiredElements.find(el => el.id === id).critical
                )
            );
            return false;
        }

        // DOM elementlerini seç
        photoVideo = document.getElementById('photoVideo');
        realtimeVideo = document.getElementById('realtimeVideo');
        photoCanvas = document.getElementById('photoCanvas');
        resultImage = document.getElementById('resultImage');
        uploadedImage = document.getElementById('uploadedImage');
        fileInput = document.getElementById('fileInput');
        
        // Callback fonksiyonunu kaydet
        imageAnalysisCallback = onImageAnalysis;

        // Event dinleyicilerini ekle
        setupEventListeners();

        // Başlangıçta varsayılan sekmeyi aktifleştir
        switchTab('photo');

        // Electron ortamını kontrol et ve kamera listesini getir
        if (window.environment && window.environment.isElectron) {
            try {
                await loadAvailableCameras();
            } catch (error) {
                console.error('Kamera listesi yüklenirken hata oluştu:', error);
            }
        }
        
        return true;
    };

    /**
     * Kullanılabilir kameraları yükler (Electron'a özgü)
     */
    const loadAvailableCameras = async () => {
        if (window.electronAPI && window.electronAPI.getVideoSources) {
            try {
                const cameras = await window.electronAPI.getVideoSources();
                console.log('Kullanılabilir kameralar:', cameras);
                
                // Kameralara göre UI güncellemesi yapılabilir
                // Örneğin: Kamera seçim dropdown'ı eklenebilir
            } catch (error) {
                console.error('Kamera listesi alınırken hata:', error);
            }
        }
    };

    /**
     * Belirli bir kamera aygıtını seçer
     * @param {string} deviceId - Kamera aygıt ID'si
     */
    const selectCamera = (deviceId) => {
        currentConstraints = { 
            video: deviceId ? { deviceId: { exact: deviceId } } : true,
            audio: false 
        };
    };

    /**
     * Event dinleyicilerini ayarlar
     */
    const setupEventListeners = () => {
        // Tab butonları
        const takePhotoTab = document.getElementById('takePhotoTab');
        const uploadImageTab = document.getElementById('uploadImageTab');
        const realTimeTab = document.getElementById('realTimeTab');
        
        // Fotoğraf çekme modu butonları
        const startPhotoCamera = document.getElementById('startPhotoCamera');
        const stopPhotoCamera = document.getElementById('stopPhotoCamera');
        const capturePhotoBtn = document.getElementById('capturePhotoBtn');
        
        // Resim yükleme modu butonları
        const chooseFileBtn = document.getElementById('chooseFileBtn');
        
        // Gerçek zamanlı mod butonları
        const startRealtimeBtn = document.getElementById('startRealtimeBtn');
        const stopRealtimeBtn = document.getElementById('stopRealtimeBtn');
        
        // Sonuç bölümü butonları
        const backToCamera = document.getElementById('backToCamera');
        const analyzePhotoBtn = document.getElementById('analyzePhotoBtn');
        
        // Tab butonları için event listeners
        if (takePhotoTab) {
            takePhotoTab.addEventListener('click', () => switchTab('photo'));
        }
        
        if (uploadImageTab) {
            uploadImageTab.addEventListener('click', () => switchTab('upload'));
        }
        
        if (realTimeTab) {
            realTimeTab.addEventListener('click', () => switchTab('realtime'));
        }
        
        // Fotoğraf çekme modu butonları için event listeners
        if (startPhotoCamera) {
            startPhotoCamera.addEventListener('click', startPhotoMode);
        }
        
        if (stopPhotoCamera) {
            stopPhotoCamera.addEventListener('click', stopPhotoMode);
        }
        
        if (capturePhotoBtn) {
            capturePhotoBtn.addEventListener('click', capturePhoto);
        }
        
        // Resim yükleme modu butonları için event listeners
        if (chooseFileBtn) {
            chooseFileBtn.addEventListener('click', () => {
                // Electron ortamında dosya seçici kullan
                if (window.electronAPI && window.electronAPI.openImage) {
                    window.electronAPI.openImage()
                        .then(result => {
                            if (result.success) {
                                handleElectronImage(result.data, result.filePath);
                            }
                        })
                        .catch(error => {
                            console.error('Resim yükleme hatası:', error);
                        });
                } else if (fileInput) {
                    // Tarayıcı ortamında normal file input kullan
                    fileInput.click();
                }
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', handleFileSelect);
            
            // Sürükle bırak için event listeners
            const uploadCameraView = document.getElementById('uploadCameraView');
            if (uploadCameraView) {
                uploadCameraView.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadCameraView.classList.add('drag-over');
                });
                
                uploadCameraView.addEventListener('dragleave', () => {
                    uploadCameraView.classList.remove('drag-over');
                });
                
                uploadCameraView.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadCameraView.classList.remove('drag-over');
                    
                    if (e.dataTransfer.files.length) {
                        handleFiles(e.dataTransfer.files);
                    }
                });
                
                const uploadPlaceholder = document.getElementById('uploadPlaceholder');
                if (uploadPlaceholder) {
                    uploadPlaceholder.addEventListener('click', () => {
                        if (window.electronAPI && window.electronAPI.openImage) {
                            window.electronAPI.openImage()
                                .then(result => {
                                    if (result.success) {
                                        handleElectronImage(result.data, result.filePath);
                                    }
                                })
                                .catch(error => {
                                    console.error('Resim yükleme hatası:', error);
                                });
                        } else if (fileInput) {
                            fileInput.click();
                        }
                    });
                }
            }
        }
        
        // Gerçek zamanlı mod butonları için event listeners
        if (startRealtimeBtn) {
            startRealtimeBtn.addEventListener('click', startRealtimeMode);
        }
        
        if (stopRealtimeBtn) {
            stopRealtimeBtn.addEventListener('click', stopRealtimeMode);
        }
        
        // Sonuç bölümü butonları için event listeners
        if (backToCamera) {
            backToCamera.addEventListener('click', () => {
                showTab(currentTab);
                hideResultSection();
            });
        }
        
        if (analyzePhotoBtn) {
            analyzePhotoBtn.addEventListener('click', analyzePhoto);
        }
    };

    /**
     * Tab değiştirme işlevi
     * @param {string} tabId - Tab ID ('photo', 'upload', 'realtime')
     */
    const switchTab = (tabId) => {
        // Önceki işlevleri temizle
        if (photoStreaming) stopPhotoMode();
        if (realtimeStreaming) stopRealtimeMode();
        
        // Tüm tabları ve içeriklerini gizle
        const tabs = document.querySelectorAll('.camera-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const tabContents = document.querySelectorAll('.camera-tab-content');
        tabContents.forEach(content => content.style.display = 'none');
        
        // Sonuç bölümünü gizle
        hideResultSection();
        
        // Doğru ID'yi belirle
        let tabElementId;
        switch(tabId) {
            case 'photo':
                tabElementId = 'takePhotoTab';
                break;
            case 'upload':
                tabElementId = 'uploadImageTab';
                break;
            case 'realtime':
                tabElementId = 'realTimeTab';
                break;
            default:
                tabElementId = 'takePhotoTab';
        }
        
        // Seçilen tabı ve içeriğini göster
        const selectedTab = document.getElementById(tabElementId);
        const selectedContent = document.getElementById(`${tabId}TabContent`);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.style.display = 'block';
        
        // Geçerli tabı güncelle
        currentTab = tabId;
    };
    
    /**
     * Sonuç bölümünü gösterir
     */
    const showResultSection = () => {
        // Tüm tab içerikleri gizle
        const tabContents = document.querySelectorAll('.camera-tab-content');
        tabContents.forEach(content => content.style.display = 'none');
        
        // Sonuç bölümünü göster
        const resultSection = document.getElementById('resultSection');
        if (resultSection) resultSection.style.display = 'block';
    };
    
    /**
     * Sonuç bölümünü gizler
     */
    const hideResultSection = () => {
        const resultSection = document.getElementById('resultSection');
        if (resultSection) resultSection.style.display = 'none';
    };
    
    /**
     * Belirli bir tabı gösterir
     * @param {string} tabId - Tab ID ('photo', 'upload', 'realtime')
     */
    const showTab = (tabId) => {
        const tabContent = document.getElementById(`${tabId}TabContent`);
        if (tabContent) tabContent.style.display = 'block';
        
        // Doğru ID'yi belirle
        let tabElementId;
        switch(tabId) {
            case 'photo':
                tabElementId = 'takePhotoTab';
                break;
            case 'upload':
                tabElementId = 'uploadImageTab';
                break;
            case 'realtime':
                tabElementId = 'realTimeTab';
                break;
            default:
                tabElementId = 'takePhotoTab';
        }
        
        const tabButton = document.getElementById(tabElementId);
        if (tabButton) tabButton.classList.add('active');
    };
    
    /**
     * Fotoğraf modunu başlatır
     */
    const startPhotoMode = async () => {
        if (photoStreaming) return;
        
        try {
            // Kamera kısıtlamalarını belirle
            const constraints = currentConstraints.video 
                ? currentConstraints 
                : { video: true, audio: false };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            photoVideo.srcObject = stream;
            photoVideo.style.display = 'block';
            photoVideo.play();
            photoStreaming = true;
            
            // Arayüz elementlerini güncelle
            document.querySelector('#photoCameraView .camera-placeholder').style.display = 'none';
            document.getElementById('startPhotoCamera').style.display = 'none';
            document.getElementById('stopPhotoCamera').style.display = 'inline-flex';
            document.getElementById('capturePhotoBtn').style.display = 'inline-flex';
        } catch (err) {
            console.error("Kamera erişim hatası: ", err);
            
            // Electron ortamında daha spesifik hata mesajı göster
            if (window.environment && window.environment.isElectron) {
                const errorMessage = err.name === 'NotAllowedError' 
                    ? "Kamera erişimine izin verilmedi. Lütfen sistem ayarlarından kamera izinlerini kontrol edin."
                    : (err.name === 'NotFoundError' 
                        ? "Kamera cihazı bulunamadı. Lütfen bir kamera bağlı olduğundan emin olun."
                        : "Kameraya erişilirken bir hata oluştu. Lütfen kamera bağlantısını kontrol edin.");
                        
                alert(errorMessage);
            } else {
                alert("Kameraya erişilemedi. Lütfen kamera erişim izinlerini kontrol edin.");
            }
        }
    };
    
    /**
     * Fotoğraf modunu durdurur
     */
    const stopPhotoMode = () => {
        if (!photoStreaming || !photoVideo.srcObject) return;
        
        try {
            const stream = photoVideo.srcObject;
            const tracks = stream.getTracks();
            
            tracks.forEach(track => track.stop());
            photoVideo.srcObject = null;
            photoVideo.style.display = 'none';
            photoStreaming = false;
            
            // Arayüz elementlerini güncelle
            document.querySelector('#photoCameraView .camera-placeholder').style.display = 'flex';
            document.getElementById('startPhotoCamera').style.display = 'inline-flex';
            document.getElementById('stopPhotoCamera').style.display = 'none';
            document.getElementById('capturePhotoBtn').style.display = 'none';
        } catch (err) {
            console.error("Kamera durdurma hatası: ", err);
        }
    };
    
    /**
     * Fotoğraf çeker
     */
    const capturePhoto = () => {
        if (!photoStreaming) return;
        
        const width = photoVideo.videoWidth;
        const height = photoVideo.videoHeight;
        
        if (width && height) {
            photoCanvas.width = width;
            photoCanvas.height = height;
            
            const context = photoCanvas.getContext('2d');
            context.drawImage(photoVideo, 0, 0, width, height);
            
            const dataUrl = photoCanvas.toDataURL('image/png');
            
            // Kamerayı durdur
            stopPhotoMode();
            
            // Sonuç görüntüsünü ayarla
            resultImage.src = dataUrl;
            
            // Electron ortamında, resmi kaydetme seçeneği ekle
            if (window.environment && window.environment.isElectron) {
                // Burada bir "resmi kaydet" butonu eklenebilir
                // Şimdilik sadece sonuç bölümünü gösterelim
            }
            
            // Sonuç bölümünü göster
            showResultSection();
        }
    };
    
    /**
     * Gerçek zamanlı modu başlatır
     */
    const startRealtimeMode = async () => {
        if (realtimeStreaming) return;
        
        try {
            // Kamera kısıtlamalarını belirle
            const constraints = currentConstraints.video 
                ? currentConstraints 
                : { video: true, audio: false };
                
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            realtimeVideo.srcObject = stream;
            realtimeVideo.style.display = 'block';
            realtimeVideo.play();
            realtimeStreaming = true;
            
            // Arayüz elementlerini güncelle
            document.getElementById('realtimePlaceholder').style.display = 'none';
            document.getElementById('startRealtimeBtn').style.display = 'none';
            document.getElementById('stopRealtimeBtn').style.display = 'inline-flex';
            document.getElementById('detectionOverlay').style.display = 'block';
            
            // Gerçek zamanlı analiz burada yapılabilir
            startRealtimeAnalysis();
        } catch (err) {
            console.error("Kamera erişim hatası: ", err);
            
            // Electron ortamında daha spesifik hata mesajı göster
            if (window.environment && window.environment.isElectron) {
                const errorMessage = err.name === 'NotAllowedError' 
                    ? "Kamera erişimine izin verilmedi. Lütfen sistem ayarlarından kamera izinlerini kontrol edin."
                    : (err.name === 'NotFoundError' 
                        ? "Kamera cihazı bulunamadı. Lütfen bir kamera bağlı olduğundan emin olun."
                        : "Kameraya erişilirken bir hata oluştu. Lütfen kamera bağlantısını kontrol edin.");
                        
                alert(errorMessage);
            } else {
                alert("Kameraya erişilemedi. Lütfen kamera erişim izinlerini kontrol edin.");
            }
        }
    };
    
    /**
     * Gerçek zamanlı modu durdurur
     */
    const stopRealtimeMode = () => {
        if (!realtimeStreaming) return;
        
        try {
            const stream = realtimeVideo.srcObject;
            const tracks = stream.getTracks();
            
            tracks.forEach(track => track.stop());
            realtimeVideo.srcObject = null;
            realtimeVideo.style.display = 'none';
            realtimeStreaming = false;
            
            // Arayüz elementlerini güncelle
            document.getElementById('realtimePlaceholder').style.display = 'flex';
            document.getElementById('startRealtimeBtn').style.display = 'inline-flex';
            document.getElementById('stopRealtimeBtn').style.display = 'none';
            document.getElementById('detectionOverlay').style.display = 'none';
            
            // Gerçek zamanlı analiz durduruluyor
            stopRealtimeAnalysis();
        } catch (err) {
            console.error("Kamera durdurma hatası: ", err);
        }
    };
    
    /**
     * Electron aracılığıyla yüklenen resmi işler
     * @param {string} imageData - Base64 formatında resim verisini
     * @param {string} filePath - Dosya yolu
     */
    const handleElectronImage = (imageData, filePath) => {
        // Yüklenmiş resmi göster
        uploadedImage.src = imageData;
        uploadedImage.style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
        
        // Sonuç görüntüsünü de ayarla
        resultImage.src = imageData;
        
        // Dosya adını göster (isteğe bağlı)
        const fileNameParts = filePath.split(/[\\/]/);
        const fileName = fileNameParts[fileNameParts.length - 1];
        console.log(`Yüklenen dosya: ${fileName}`);
        
        // Sonuç bölümünü göster
        showResultSection();
    };
    
    /**
     * Dosya seçim işleyicisi
     * @param {Event} e - Change event
     */
    const handleFileSelect = (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    };
    
    /**
     * Dosyaları işler
     * @param {FileList} files - İşlenecek dosyalar
     */
    const handleFiles = (files) => {
        const file = files[0];
        if (!file.type.match('image/jpeg|image/jpg|image/png')) {
            alert('Lütfen sadece PNG, JPG veya JPEG dosyası seçin.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            // Yüklenmiş resmi göster
            uploadedImage.src = e.target.result;
            uploadedImage.style.display = 'block';
            document.getElementById('uploadPlaceholder').style.display = 'none';
            
            // Sonuç görüntüsünü de ayarla
            resultImage.src = e.target.result;
            
            // Sonuç bölümünü göster
            showResultSection();
        };
        
        reader.readAsDataURL(file);
    };
    
    /**
     * Fotoğrafı analiz eder
     */
    const analyzePhoto = async () => {
        // Yükleme göstergesi eklenebilir
        
        // Electron ortamında özel API kullan
        if (window.electronAPI && window.electronAPI.detectFood) {
            try {
                // UI'a yükleme durumu göster
                const detectedItemsEl = document.getElementById('detectedItems');
                if (detectedItemsEl) {
                    detectedItemsEl.innerHTML = '<li class="loading-item"><div class="loading-spinner"></div> Yemekler tespit ediliyor...</li>';
                }
                
                // Electron API'si ile resim analizi
                const detectedFoods = await window.electronAPI.detectFood(resultImage.src);
                
                // Tespit sonuçlarını işle
                if (imageAnalysisCallback) {
                    imageAnalysisCallback(detectedFoods);
                }
            } catch (error) {
                console.error('Yemek tespiti hatası:', error);
                alert('Yemek tespiti sırasında bir hata oluştu. Lütfen tekrar deneyin.');
            }
        } else {
            // Tarayıcı ortamında normal callback kullan
            if (imageAnalysisCallback) {
                imageAnalysisCallback(resultImage.src);
            }
        }
    };
    
    /**
     * Görüntüyü kaydet (Electron ortamı için)
     */
    const saveImage = async () => {
        if (!resultImage.src) return;
        
        if (window.electronAPI && window.electronAPI.saveImage) {
            try {
                const result = await window.electronAPI.saveImage(resultImage.src);
                if (result.success) {
                    console.log(`Görüntü kaydedildi: ${result.filePath}`);
                }
            } catch (error) {
                console.error('Görüntü kaydetme hatası:', error);
                alert('Görüntü kaydedilirken bir hata oluştu.');
            }
        }
    };
    
    /**
     * Gerçek zamanlı analizi başlatır
     */
    let realtimeAnalysisInterval = null;
    const startRealtimeAnalysis = () => {
        realtimeAnalysisInterval = setInterval(async () => {
            if (!realtimeStreaming) return;
            
            // Belirli aralıklarla kare yakala
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = realtimeVideo.videoWidth;
            tempCanvas.height = realtimeVideo.videoHeight;
            
            const context = tempCanvas.getContext('2d');
            context.drawImage(realtimeVideo, 0, 0, tempCanvas.width, tempCanvas.height);
            
            const frameData = tempCanvas.toDataURL('image/png');
            
            // Electron ortamında özel API kullan
            if (window.electronAPI && window.electronAPI.detectFood) {
                try {
                    const detectedFoods = await window.electronAPI.detectFood(frameData);
                    
                    // Tespit sonuçlarını işle
                    if (imageAnalysisCallback) {
                        imageAnalysisCallback(detectedFoods);
                    }
                } catch (error) {
                    console.error('Gerçek zamanlı tespit hatası:', error);
                }
            } else {
                // Tarayıcı ortamında normal callback kullan
                if (imageAnalysisCallback) {
                    imageAnalysisCallback(frameData);
                }
            }
        }, 3000); // 3 saniyede bir kare analiz et
    };
    
    /**
     * Gerçek zamanlı analizi durdurur
     */
    const stopRealtimeAnalysis = () => {
        if (realtimeAnalysisInterval) {
            clearInterval(realtimeAnalysisInterval);
            realtimeAnalysisInterval = null;
        }
    };

    // Public API
    return {
        init,
        switchTab,
        capturePhoto,
        handleFiles,
        analyzePhoto,
        saveImage,
        selectCamera
    };
})();

// CommonJS ve ES module uyumluluğu
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraModule;
} else if (typeof window !== 'undefined') {
    window.CameraModule = CameraModule;
}