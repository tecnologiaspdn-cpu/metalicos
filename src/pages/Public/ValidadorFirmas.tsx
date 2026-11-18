import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { validadorFirmasApi } from "../../services/validadorFirmas/validadorFirmasApi";

/**
 * Landing page pública (sin autenticación) del validador de firmas.
 * Enlazada desde el QR incrustado en la última hoja de cada PDF firmado:
 * `${VALIDADOR_FIRMAS_BASE_URL}/<codigo_documento>`. Ruta: /validador-firmas/:codigo.
 */
const ValidadorFirmas: React.FC = () => {
    const { codigo } = useParams<{ codigo: string }>();
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ignore = false;
        let creada: string | null = null;
        setLoading(true);
        setError(null);
        setUrl(null);

        if (!codigo) {
            setError("Código de documento no válido.");
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const blob = await validadorFirmasApi.obtenerPdf(codigo);
                if (ignore) return;
                creada = URL.createObjectURL(blob);
                setUrl(creada);
            } catch (e: any) {
                if (!ignore) setError(e?.message || "No se pudo validar el documento.");
            } finally {
                if (!ignore) setLoading(false);
            }
        })();

        return () => {
            ignore = true;
            if (creada) URL.revokeObjectURL(creada);
        };
    }, [codigo]);

    return (
        <div className="flex min-h-screen flex-col bg-gray-100">
            <header className="border-b bg-white px-6 py-4 shadow-sm">
                <h1 className="text-lg font-semibold text-gray-800">Validador de Firmas Electrónicas</h1>
                <p className="text-sm text-gray-500">Polimetálicos del Norte S.A.C.</p>
            </header>

            <main className="flex flex-1 flex-col items-center justify-center p-4">
                {loading && <p className="text-sm text-gray-500">Validando documento…</p>}

                {!loading && error && (
                    <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
                        <i className="dx-icon-warning mb-2 text-2xl text-rose-500" />
                        <p className="text-sm font-medium text-rose-700">{error}</p>
                        {codigo && <p className="mt-2 break-all text-xs text-rose-400">Código: {codigo}</p>}
                    </div>
                )}

                {!loading && !error && url && (
                    <div className="flex w-full max-w-4xl flex-col gap-3">
                        {/* Muchos navegadores móviles no renderizan PDFs incrustados (el
                            <object> de abajo queda en blanco/con el aviso de reserva ahí),
                            así que siempre se ofrece una acción que sí funciona en todos lados. */}
                        <div className="flex justify-center gap-2">
                            <a
                                href={url}
                                download={`documento-${codigo}.pdf`}
                                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                                <i className="dx-icon-download" /> Descargar PDF
                            </a>
                            <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                <i className="dx-icon-export" /> Abrir en otra pestaña
                            </a>
                        </div>
                        <object
                            data={`${url}#toolbar=1&navpanes=0&view=FitH`}
                            type="application/pdf"
                            className="h-[80vh] w-full rounded-xl border bg-white shadow"
                        >
                            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-gray-500">
                                <p>Tu navegador no puede previsualizar el PDF aquí.</p>
                                <p>Usa el botón "Descargar PDF" o "Abrir en otra pestaña" de arriba.</p>
                            </div>
                        </object>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ValidadorFirmas;
