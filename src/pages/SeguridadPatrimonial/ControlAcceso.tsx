import React, { useState, useRef, useEffect, useCallback } from 'react';

// Tipos para TypeScript
interface AttendanceRecord {
    fecha: string;
    nombre_completo: string;
    hora_entrada: string | null;
    hora_salida: string | null;
    horas_trabajadas: number;
}

interface User {
    codigo_empleado: string;
    nombre_completo: string;
    tipo_documento: string;
    numero_documento: string;
    tipo_empleado: string;
    direccion: string;
    guardia: 'dia' | 'noche';
    telefono?: string;
    email?: string;
}

interface APIResponse<T = any> {
    success: boolean;
    message: string;
    data: T;
}

// Simulación de API y funciones globales para el ejemplo
const mockAPI = {
    get: async (endpoint: string, params?: any): Promise<APIResponse<AttendanceRecord[]>> => {
        // Simular datos de ejemplo
        return {
            success: true,
            message: 'OK',
            data: [
                {
                    fecha: new Date().toISOString().slice(0, 10),
                    nombre_completo: 'Juan Pérez',
                    hora_entrada: '08:30',
                    hora_salida: null,
                    horas_trabajadas: 0
                },
                {
                    fecha: new Date().toISOString().slice(0, 10),
                    nombre_completo: 'María García',
                    hora_entrada: '09:00',
                    hora_salida: '17:30',
                    horas_trabajadas: 8.5
                }
            ]
        };
    },
    post: async (endpoint: string, data: any): Promise<APIResponse> => {
        console.log('API Call:', endpoint, data);
        return {
            success: true,
            message: 'Asistencia registrada correctamente',
            data: null
        };
    }
};

const mockUser: User = {
    codigo_empleado: 'EMP001',
    nombre_completo: 'Juan Carlos Pérez García',
    tipo_documento: 'DNI',
    numero_documento: '12345678',
    tipo_empleado: 'Administrativo',
    direccion: 'Av. Los Pinos 123, San Isidro, Lima',
    guardia: 'dia',
    telefono: '987-654-321',
    email: 'juan.perez@empresa.com'
};

// Componente para generar QR (simplificado para el ejemplo)
const QRCodeDisplay: React.FC<{ value: string; size?: number }> = ({ value, size = 250 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        // En un proyecto real, aquí usarías una librería como qrious o qr-code
        // Para este ejemplo, mostramos un placeholder
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Dibujar un placeholder de QR
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = '#fff';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('QR CODE', size / 2, size / 2 - 10);
                ctx.fillText(value, size / 2, size / 2 + 10);
            }
        }
    }, [value, size]);

    return <canvas ref={canvasRef} width={size} height={size} className="border rounded-lg" />;
};

const ControlAcceso: React.FC = () => {
    // Estados
    const [isScanning, setIsScanning] = useState(false);
    const [detectedCode, setDetectedCode] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [scanStatus, setScanStatus] = useState('');
    const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Referencias
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationRef = useRef<number>();

    // Función para mostrar notificaciones
    const showNotification = (message: string, type: 'success' | 'error' | 'warning') => {
        // En un proyecto real, usarías una librería de toast/notifications
        alert(`${type.toUpperCase()}: ${message}`);
    };

    // Función para reproducir sonido de confirmación
    const playBeep = useCallback(() => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.warn('No se pudo reproducir el sonido:', error);
        }
    }, []);

    // Cargar registros de hoy
    const loadTodayRecords = useCallback(async () => {
        try {
            setLoading(true);
            const response = await mockAPI.get('/asistencia/historial', { limite: 40 });

            if (response.success) {
                const todayStr = new Date().toISOString().slice(0, 10);
                const todayData = response.data.filter(record => record.fecha === todayStr);
                setTodayRecords(todayData);
            }
        } catch (error) {
            console.error('Error cargando registros:', error);
            showNotification('Error al cargar registros', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    // Función de escaneo
    const scanFrame = useCallback(() => {
        if (!isScanning || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animationRef.current = requestAnimationFrame(scanFrame);
            return;
        }

        // Ajustar canvas al tamaño del video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Dibujar frame actual
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Obtener datos de imagen
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        // Simulación de detección QR (en proyecto real usarías jsQR)
        // Para este ejemplo, simulamos detección después de 3 segundos
        if (Math.random() > 0.99) { // Simular detección aleatoria
            onQRDetected('EMP002'); // Código simulado
            return;
        }

        animationRef.current = requestAnimationFrame(scanFrame);
    }, [isScanning]);

    // Cuando se detecta un QR
    const onQRDetected = useCallback((qrData: string) => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        setDetectedCode(qrData);
        setShowResult(true);
        setScanStatus('¡Código QR detectado! Confirme para marcar asistencia.');
        playBeep();
    }, [playBeep]);

    // Iniciar escáner
    const startQRScanner = async () => {
        if (isScanning) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;

                await videoRef.current.play();

                setIsScanning(true);
                setScanStatus('Escaneando... Apunte la cámara hacia el código QR');

                // Iniciar escaneo después de que el video esté listo
                videoRef.current.addEventListener('loadedmetadata', () => {
                    scanFrame();
                });
            }
        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            showNotification('Error al acceder a la cámara: ' + (error as Error).message, 'error');
        }
    };

    // Detener escáner
    const stopQRScanner = useCallback(() => {
        setIsScanning(false);

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setShowResult(false);
        setScanStatus('');
        setDetectedCode(null);
    }, []);

    // Procesar código detectado
    const processDetectedQR = async () => {
        if (!detectedCode) return;

        try {
            const response = await mockAPI.post('/asistencia/registrar', {
                codigo_empleado: detectedCode,
                metodo: 'qr'
            });

            if (response.success) {
                showNotification(response.message, 'success');
                stopQRScanner();
                await loadTodayRecords();
            } else {
                showNotification(response.message, 'error');
                continueScanning();
            }
        } catch (error) {
            console.error('Error al procesar código QR:', error);
            showNotification('Error al procesar código QR', 'error');
            continueScanning();
        }
    };

    // Continuar escaneando
    const continueScanning = () => {
        setShowResult(false);
        setScanStatus('Escaneando... Apunte la cámara hacia el código QR');
        setDetectedCode(null);

        if (isScanning) {
            scanFrame();
        }
    };

    // Marcar asistencia manual
    const registerAttendance = async () => {
        try {
            const response = await mockAPI.post('/asistencia/registrar', {
                codigo_empleado: mockUser.codigo_empleado,
                metodo: 'manual'
            });

            if (response.success) {
                showNotification(response.message, 'success');
                await loadTodayRecords();
            } else {
                showNotification(response.message, 'error');
            }
        } catch (error: any) {
            if (error.status === 400 && error.data?.message) {
                showNotification(error.data.message, 'warning');
            } else {
                showNotification('Error al registrar asistencia', 'error');
            }
        }
    };

    // Funciones de utilidad para estado de registros
    const getStatusClass = (record: AttendanceRecord): string => {
        if (!record.hora_entrada) return 'bg-red-100 text-red-800';
        if (!record.hora_salida) return 'bg-yellow-100 text-yellow-800';
        if (record.horas_trabajadas >= 8) return 'bg-green-100 text-green-800';
        return 'bg-yellow-100 text-yellow-800';
    };

    const getStatusText = (record: AttendanceRecord): string => {
        if (!record.hora_entrada) return 'Ausente';
        if (!record.hora_salida) return 'En progreso';
        if (record.horas_trabajadas >= 8) return 'Completo';
        return 'Parcial';
    };

    // Cargar datos iniciales
    useEffect(() => {
        loadTodayRecords();
    }, [loadTodayRecords]);

    // Cleanup al desmontar componente
    useEffect(() => {
        return () => {
            stopQRScanner();
        };
    }, [stopQRScanner]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Scanner QR */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Escanear Código QR</h3>
                    <div className="text-center">
                        <div className="mb-4 relative">
                            <video
                                ref={videoRef}
                                className={`w-full max-w-md mx-auto rounded-lg ${isScanning ? 'block' : 'hidden'}`}
                                autoPlay
                                muted
                                playsInline
                            />
                            <canvas ref={canvasRef} className="hidden" />

                            {showResult && (
                                <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                                    <p className="text-lg font-semibold">Código detectado:</p>
                                    <p className="text-blue-600 font-mono">{detectedCode}</p>
                                    <button
                                        onClick={processDetectedQR}
                                        className="mt-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                                    >
                                        Marcar Asistencia
                                    </button>
                                    <button
                                        onClick={continueScanning}
                                        className="mt-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 ml-2"
                                    >
                                        Continuar Escaneando
                                    </button>
                                </div>
                            )}

                            {scanStatus && (
                                <div className="mt-2 text-sm text-gray-600">
                                    {scanStatus}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={startQRScanner}
                            className={`bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 mr-2 ${isScanning ? 'hidden' : ''}`}
                        >
                            <i className="fas fa-camera mr-2"></i>Iniciar Escáner
                        </button>
                        <button
                            onClick={stopQRScanner}
                            className={`bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 ${!isScanning ? 'hidden' : ''}`}
                        >
                            <i className="fas fa-stop mr-2"></i>Detener Escáner
                        </button>
                    </div>
                </div>

                {/* Mi Perfil y Código QR */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Mi Perfil</h3>

                    {/* Botón de marcar asistencia manual */}
                    <div className="text-center mb-6">
                        <button
                            onClick={registerAttendance}
                            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-semibold"
                        >
                            <i className="fas fa-clock mr-2"></i>Marcar Asistencia Manual
                        </button>
                    </div>

                    {/* Información del perfil */}
                    <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Nombres Completos
                                </label>
                                <p className="text-sm font-medium text-gray-900 mt-1">
                                    {mockUser.nombre_completo}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Tipo Documento
                                    </label>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                        {mockUser.tipo_documento}
                                    </p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        N° Documento
                                    </label>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                        {mockUser.numero_documento}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Tipo Empleado
                                    </label>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                        {mockUser.tipo_empleado}
                                    </p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Guardia
                                    </label>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${mockUser.guardia === 'dia'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            <i className={`fas ${mockUser.guardia === 'dia' ? 'fa-sun' : 'fa-moon'} mr-1`}></i>
                                            {mockUser.guardia === 'dia' ? 'Día' : 'Noche'}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Dirección
                                </label>
                                <p className="text-sm font-medium text-gray-900 mt-1">
                                    {mockUser.direccion}
                                </p>
                            </div>

                            {(mockUser.telefono || mockUser.email) && (
                                <div className="grid grid-cols-2 gap-3">
                                    {mockUser.telefono && (
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                Teléfono
                                            </label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">
                                                {mockUser.telefono}
                                            </p>
                                        </div>
                                    )}
                                    {mockUser.email && (
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                Email
                                            </label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">
                                                {mockUser.email}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mi Código QR - Pequeño */}
                    <div className="text-center border-t pt-4">
                        <h4 className="text-md font-semibold text-gray-700 mb-3">Mi Código QR</h4>
                        <div className="flex justify-center mb-3">
                            <QRCodeDisplay value={mockUser.codigo_empleado} size={120} />
                        </div>
                        <p className="text-xs text-gray-500">
                            Código: <span className="font-mono font-bold text-gray-700">{mockUser.codigo_empleado}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Historial de Hoy */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Registros de Hoy</h3>
                <div className="space-y-3">
                    {loading ? (
                        <div className="text-center text-gray-500">Cargando...</div>
                    ) : todayRecords.length === 0 ? (
                        <div className="text-center text-gray-500">No hay registros para hoy</div>
                    ) : (
                        todayRecords.map((record, index) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <span className="font-semibold">{record.nombre_completo}</span>
                                    <div className="text-sm text-gray-600">
                                        Entrada: {record.hora_entrada || 'N/A'} |
                                        Salida: {record.hora_salida || 'N/A'}
                                    </div>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass(record)}`}>
                                    {getStatusText(record)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ControlAcceso;