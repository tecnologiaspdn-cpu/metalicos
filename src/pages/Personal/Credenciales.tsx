import React, { useState, useEffect } from 'react';
import Credenciales from '../../components/Personal/Credenciales';
import { apiManager } from '../../services/api/ApiManager';
import { useParams } from 'react-router-dom';
import moment from 'moment';

const CredencialesPage = ({ idPersonal }: any) => {
    //const { idPersonal } = useParams<{ idPersonal?: string }>();

    const [datosUsuario, setDatosUsuario] = useState<any>({
        nombres: "",
        cargo: "",
        departamento: "",
        empresa: "",
        qrData: "",
        codigoImagen: "",
        fotoBase64: "",
        fechaVencimiento: "2025-12-31", // Ajusta según tu API
        // Datos de ejemplo - ajusta según tu API
        examenesRealizados: [],
        capacitaciones: [
            { nombre: "Sin capacitaciones" },
        ]
    });
    useEffect(() => {
        const response = apiManager.auth.getCredenciales({ "persona_id": idPersonal || "" });
        response.then((res: any) => {
            console.log("credenciales", res.data);
            setDatosUsuario({
                nombres: res.data.usuario.nombres_completos,
                cargo: res.data.usuario.nombre_puesto,
                departamento: res.data.usuario.nombre_area,
                empresa: res.data.usuario.razon_social,
                qrData: res.data.usuario.qr_hash,
                codigoImagen: res.data.usuario.url_documento,
                fechaVencimiento: res.data.usuario.fecha_vencimiento || moment().format('YYYY-MM-DD'),
                examenesRealizados: res.data.examenes || [],
                capacitaciones: res.data.capacitaciones || [{ nombre: "Sin capacitaciones" }]
            });
        })
    }, [idPersonal]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const obtenerImagenBase64 = async (codigoImagen: string) => {
        if (!codigoImagen) {
            console.log('No hay código de imagen disponible');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await apiManager.auth.getFoto({ fotoUrl: codigoImagen });
            if (!response.value) {
                //throw new Error(`Error al obtener imagen: ${response.status}`);
                //seteo null la imagen 
                setDatosUsuario((prev: any) => ({
                    ...prev,
                    fotoBase64: ""
                }));
                return
            }

            const imagenBase64 = response.value.foto_base64 || "";

            if (imagenBase64) {
                setDatosUsuario((prev: any) => ({
                    ...prev,
                    fotoBase64: imagenBase64
                }));
            }

        } catch (err) {
            console.error('Error al obtener imagen:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (datosUsuario.codigoImagen) {
            obtenerImagenBase64(datosUsuario.codigoImagen);
        }
    }, [datosUsuario.codigoImagen]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-12 px-4 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg font-semibold">Cargando credencial...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-12 px-4 flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
                    <div className="text-red-600 text-center">
                        <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-xl font-bold mb-2">Error al cargar credencial</h3>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <button
                            onClick={() => obtenerImagenBase64(datosUsuario.codigoImagen)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-12 px-4">
            <Credenciales
                nombre={datosUsuario.nombres}
                cargo={datosUsuario.cargo}
                departamento={datosUsuario.departamento}
                empresa={datosUsuario.empresa}
                qrData={datosUsuario.qrData}
                fotoBase64={datosUsuario.fotoBase64}
                autorizado={true}
                fechaVencimiento={datosUsuario.fechaVencimiento}
                examenesRealizados={datosUsuario.examenesRealizados}
                capacitaciones={datosUsuario.capacitaciones}
            />

            {/* Botón para actualizar foto */}
            {/* <div className="flex justify-center mt-6">
                <button
                    onClick={() => obtenerImagenBase64(datosUsuario.codigoImagen)}
                    className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                    Actualizar foto
                </button>
            </div> */}
        </div>
    );
};

export default CredencialesPage;