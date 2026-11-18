import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { useMiFirma } from '../../hooks/useMiFirma';
import { EstadoRubrica, RUBRICA_ACCEPT, RUBRICA_TAMANO_MAXIMO_MB, validarArchivoRubrica } from '../../types/MiFirma';

/**
 * Módulo "Mi Firma" — Configuración de Rúbrica.
 *
 * Permite al usuario logueado cargar / reemplazar la imagen de su rúbrica y
 * activarla o desactivarla. Ver src/services/miFirma/miFirmaApi.ts.
 */
const MiFirma: React.FC = () => {
    const { usuarioSesion, rubrica, loading, guardando, guardarRubrica } = useMiFirma();
    const inputRef = useRef<HTMLInputElement>(null);

    const [imagen, setImagen] = useState<File | null>(null);
    const [imagenUrl, setImagenUrl] = useState<string | null>(null);
    const [estado, setEstado] = useState<EstadoRubrica>('Activo');

    // Precarga el formulario con la rúbrica ya guardada (si existe).
    useEffect(() => {
        setImagen(null);
        setImagenUrl(rubrica?.imagenUrl ?? null);
        setEstado(rubrica?.estado ?? 'Activo');
    }, [rubrica]);

    // Object URL para la vista previa de una imagen recién seleccionada.
    useEffect(() => {
        if (!imagen) return;
        const url = URL.createObjectURL(imagen);
        setImagenUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [imagen]);

    const hayCambios = useMemo(() => {
        if (imagen) return true;
        return (rubrica?.estado ?? 'Activo') !== estado;
    }, [imagen, estado, rubrica]);

    const nombreArchivo = imagen?.name ?? (rubrica ? rubrica.nombreArchivo : '');

    const seleccionarArchivo = (file?: File | null) => {
        if (!file) return;
        const error = validarArchivoRubrica(file);
        if (error) {
            notify(error, 'error', 3500);
            return;
        }
        setImagen(file);
    };

    const handleGuardar = async () => {
        if (!imagen && !rubrica) {
            notify('Selecciona una imagen para tu rúbrica.', 'warning', 3000);
            return;
        }
        try {
            await guardarRubrica({ imagen, estado });
            notify('Rúbrica guardada correctamente.', 'success', 3000);
            setImagen(null);
        } catch (e: any) {
            notify(e?.message || 'No se pudo guardar la rúbrica.', 'error', 3500);
        }
    };

    const handleCancelar = () => {
        setImagen(null);
        setImagenUrl(rubrica?.imagenUrl ?? null);
        setEstado(rubrica?.estado ?? 'Activo');
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-gray-800">Configuración de Rúbrica</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Aquí puedes cargar y gestionar tu rúbrica que se utilizará para firmar documentos.
                    </p>
                </div>

                <div className="rounded-2xl border bg-white p-6 shadow-sm">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        {/* ── Columna izquierda: datos ── */}
                        <div className="flex flex-col gap-5">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Usuario</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={usuarioSesion.nombres}
                                    className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-700"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Rúbrica <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-stretch overflow-hidden rounded-md border border-gray-300">
                                    <span className="flex flex-1 items-center gap-2 truncate px-3 py-2 text-sm text-gray-500">
                                        <i className="dx-icon-attach text-gray-400" />
                                        {nombreArchivo || 'Seleccionar imagen (PNG, JPG, JPEG)'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => inputRef.current?.click()}
                                        disabled={guardando}
                                        className="border-l border-gray-300 bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                                    >
                                        Examinar
                                    </button>
                                </div>
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept={RUBRICA_ACCEPT}
                                    className="hidden"
                                    onChange={(e) => {
                                        seleccionarArchivo(e.target.files?.[0]);
                                        e.target.value = '';
                                    }}
                                />
                                <p className="mt-1 text-xs text-gray-400">
                                    Formatos permitidos: PNG, JPG, JPEG. Tamaño máximo: {RUBRICA_TAMANO_MAXIMO_MB} MB.
                                </p>
                            </div>

                            <hr className="border-gray-100" />

                            <div>
                                <span className="mb-2 block text-sm font-medium text-gray-700">
                                    Estado <span className="text-red-500">*</span>
                                </span>
                                <div className="flex flex-col gap-2">
                                    {(['Activo', 'Desactivado'] as EstadoRubrica[]).map((opt) => (
                                        <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="radio"
                                                name="estadoRubrica"
                                                value={opt}
                                                checked={estado === opt}
                                                onChange={() => setEstado(opt)}
                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                            />
                                            {opt}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-700">
                                <i className="dx-icon-info mt-0.5" />
                                <span>La rúbrica activa se utilizará para firmar tus documentos.</span>
                            </div>
                        </div>

                        {/* ── Columna derecha: vista previa ── */}
                        <div className="flex flex-col">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Vista previa de la rúbrica</span>
                            <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4">
                                {loading ? (
                                    <span className="text-sm text-gray-400">Cargando…</span>
                                ) : imagenUrl ? (
                                    <img
                                        src={imagenUrl}
                                        alt="Vista previa de la rúbrica"
                                        className="max-h-56 w-full object-contain"
                                    />
                                ) : (
                                    <span className="text-center text-sm text-gray-400">
                                        La vista previa mostrará la rúbrica seleccionada.
                                    </span>
                                )}
                            </div>
                            {rubrica && (
                                <p className="mt-2 text-xs text-gray-400">
                                    Última actualización:{' '}
                                    {new Date(rubrica.fechaActualizacion).toLocaleString()}
                                    {' · '}
                                    <span
                                        className={
                                            rubrica.estado === 'Activo' ? 'text-green-600' : 'text-gray-500'
                                        }
                                    >
                                        {rubrica.estado}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-5">
                        <Button
                            text="Cancelar"
                            icon="close"
                            type="normal"
                            stylingMode="outlined"
                            onClick={handleCancelar}
                            disabled={guardando || !hayCambios}
                        />
                        <Button
                            text="Guardar Rúbrica"
                            icon="save"
                            type="success"
                            stylingMode="contained"
                            onClick={handleGuardar}
                            disabled={guardando || !hayCambios}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MiFirma;
