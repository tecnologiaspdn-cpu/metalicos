import React, { useEffect, useMemo, useRef, useState } from "react";
import { Popup } from "devextreme-react/popup";
import Button from "devextreme-react/button";
import SelectBox from "devextreme-react/select-box";
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import { DataGrid, Column, SearchPanel, Paging } from 'devextreme-react/data-grid';
import { custom } from 'devextreme/ui/dialog';
import ComuneroList from "../../components/Comunero/ComuneroList";
import ComuneroForm from "../../components/Comunero/ComuneroForm";
import { useComunero } from "../../hooks/useComunero";
import { Comunero, ComuneroFormData } from "../../types/Comunero";
import NavDropdown, { NavItem } from "../../components/NavDropdown";
import IconMenu from "../../components/Icon/IconMenu";
import { fetchMaestros } from "../../services/maestros/maestros";
import { apiManager } from "../../services/api/ApiManager";
import notify from "devextreme/ui/notify";
import moment from "moment";

// ============================================================
// FotocheckComuneroCard
// ============================================================
interface FotocheckComuneroCardProps {
    nombreCompleto: string;
    dni: string;
    fechaAdmision: string;
    hashQr: string;
    fotoBase64: string;
    domicilio?: string | null;
    nombreCaserio?: string | null;
    nombreComunidad?: string | null;
}

// Región fija impresa en el reverso del carnet
const REGION_CARNET = "La Libertad - Perú";

const CONECTORES = new Set(["de", "del", "la", "las", "los", "y", "en"]);
const aTitulo = (txt: string) =>
    txt
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((w, i) => (i > 0 && CONECTORES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ");

const IconoAviso: React.FC<{ tipo: "persona" | "ubicacion" | "gracias" }> = ({ tipo }) => {
    const paths: Record<typeof tipo, string> = {
        persona: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
        ubicacion: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z",
        gracias: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    };
    return (
        <div className="shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d={paths[tipo]} />
            </svg>
        </div>
    );
};

const FotocheckComuneroCard: React.FC<FotocheckComuneroCardProps> = ({
    nombreCompleto, dni, fechaAdmision, hashQr, fotoBase64, domicilio, nombreCaserio, nombreComunidad
}) => {
    const qrRef = useRef<HTMLDivElement>(null);

    // ---- Datos del reverso ----
    const anioAdmision = useMemo(() => {
        if (!fechaAdmision) return "—";
        const m = moment(fechaAdmision, [moment.ISO_8601, "YYYY-MM-DD", "DD/MM/YYYY", "YYYY"]);
        return m.isValid() ? m.format("YYYY") : String(fechaAdmision);
    }, [fechaAdmision]);

    const direccionLineas = useMemo(() => {
        const linea1 = [nombreCaserio ? `Caserío ${aTitulo(nombreCaserio)}` : null, domicilio ? aTitulo(domicilio) : null]
            .filter(Boolean)
            .join(", ");
        return [linea1 || "—", REGION_CARNET];
    }, [nombreCaserio, domicilio]);

    const comunidadTitulo = nombreComunidad ? aTitulo(nombreComunidad) : "Comunidad Campesina";

    const avisos = useMemo(
        () => [
            { icono: "persona" as const, texto: "Esta credencial es personal e intransferible." },
            { icono: "ubicacion" as const, texto: `Si la encuentra, por favor devuélvala a la Oficina de la ${comunidadTitulo}.` },
            { icono: "gracias" as const, texto: "Gracias por su colaboración." },
        ],
        [comunidadTitulo]
    );

    const getImageSrc = (): string | undefined => {
        if (!fotoBase64) return undefined;
        if (fotoBase64.startsWith('data:image')) return fotoBase64;
        // Detectar PNG por su firma base64 (iVBOR) vs JPEG (/9j/)
        const mime = fotoBase64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${fotoBase64}`;
    };

    const svgToBase64 = (svgData: string): string =>
        btoa(new TextEncoder().encode(svgData).reduce((s, b) => s + String.fromCharCode(b), ''));

    const imprimirFotocheck = async () => {
        try {
            const anchoA4 = 210;
            const anchoCredencial = 53.85;
            const altoCredencial = 85.85;
            const margenExterior = 0.3;
            const margenInterior = 0.3;

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const azul: [number, number, number] = [0, 102, 204];
            const verde: [number, number, number] = [34, 197, 94];
            const negro: [number, number, number] = [0, 0, 0];
            const imageSrc = getImageSrc();

            // ==================== PÁGINA 1: FRENTE — esquina superior izquierda ====================
            const offsetX = margenExterior;
            const offsetY = margenExterior;

            pdf.setFillColor(...azul);
            pdf.rect(offsetX, offsetY, anchoCredencial, 10, 'F');
            pdf.setDrawColor(...azul);
            pdf.setLineWidth(0.6);
            //pdf.rect(offsetX, offsetY, anchoCredencial, altoCredencial, 'S');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text(nombreComunidad || "Comunidad Campesina", offsetX + anchoCredencial / 2, offsetY + 6, { align: 'center' });

            let yPos = offsetY + 12;
            const maxWidth = anchoCredencial - margenInterior * 2;

            const fotoSize = 30; // 50% más grande que el tamaño original (20 mm)
            if (imageSrc) {
                try {
                    const fotoX = offsetX + anchoCredencial / 2 - fotoSize / 2;
                    pdf.setFillColor(255, 255, 255);
                    pdf.rect(fotoX - 0.5, yPos - 0.5, fotoSize + 1, fotoSize + 1, 'F');
                    const imgFormat = imageSrc.includes('image/png') ? 'PNG' : 'JPEG';
                    pdf.addImage(imageSrc, imgFormat, fotoX, yPos, fotoSize, fotoSize);
                } catch { /* sin foto */ }
                yPos += fotoSize + 5;
            }

            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(6.5);
            pdf.setFont('helvetica', 'bold');
            pdf.splitTextToSize(nombreCompleto, maxWidth).forEach((line: string) => {
                pdf.text(line, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
                yPos += 2.8;
            });

            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`DNI: ${dni}`, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
            yPos += 3;

            if (domicilio) {
                pdf.splitTextToSize(domicilio, maxWidth).forEach((line: string) => {
                    pdf.text(line, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
                    yPos += 2.5;
                });
            }
            if (nombreCaserio) {
                pdf.splitTextToSize(nombreCaserio, maxWidth).forEach((line: string) => {
                    pdf.text(line, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
                    yPos += 2.5;
                });
            }
            /*if (nombreComunidad) {
                pdf.splitTextToSize(nombreComunidad, maxWidth).forEach((line: string) => {
                    pdf.text(line, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
                    yPos += 2.5;
                });
            }*/

            /*pdf.setFont('helvetica', 'bold');
            pdf.splitTextToSize(`AÑO DE AFILIACIÓN: ${fechaAdmision}`, maxWidth).forEach((line: string) => {
                pdf.text(line, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
                yPos += 2.5;
            });*/
            yPos += 2.5;

            // La foto ampliada deja menos alto libre: el QR se ajusta al espacio
            // que queda entre el bloque de textos y la insignia inferior.
            const badgeY = offsetY + altoCredencial - 7;
            const espacioQr = badgeY - 3.5 - yPos;
            const qrSize = Math.max(15, Math.min(18, espacioQr));

            if (qrRef.current) {
                const svgElement = qrRef.current.querySelector('svg');
                if (svgElement) {
                    const svgData = new XMLSerializer().serializeToString(svgElement);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    await new Promise<void>((resolve) => {
                        img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx?.drawImage(img, 0, 0);
                            const qrX = offsetX + anchoCredencial / 2 - qrSize / 2;
                            try {
                                pdf.setFillColor(255, 255, 255);
                                pdf.rect(qrX - 1, yPos - 1, qrSize + 2, qrSize + 2, 'F');
                                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', qrX, yPos, qrSize, qrSize);
                            } catch { /* sin qr */ }
                            resolve();
                        };
                        img.src = 'data:image/svg+xml;base64,' + svgToBase64(svgData);
                    });
                }
            }

            /*pdf.setFillColor(...verde);
            pdf.roundedRect(offsetX + anchoCredencial / 2 - 14, badgeY - 2.5, 28, 5, 2.5, 2.5, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Autorizado', offsetX + anchoCredencial / 2, badgeY, { align: 'center' });*/

            // ==================== PÁGINA 2: REVERSO — esquina superior derecha (impresión doble faz) ====================
            pdf.addPage();
            //const offsetXDerecha = anchoA4 - anchoCredencial - margenExterior;
            const offsetXDerecha = 0.3;
            const offsetYDerecha = margenExterior;

            const centroX = offsetXDerecha + anchoCredencial / 2;
            const izqX = offsetXDerecha + margenInterior + 2;
            const anchoUtil = anchoCredencial - (margenInterior + 2) * 2;

            // Cabecera con el nombre de la comunidad
            const tituloComunidad = (nombreComunidad || 'COMUNIDAD CAMPESINA').toUpperCase();
            const lineasTitulo = pdf.splitTextToSize(tituloComunidad, anchoUtil);
            const altoCabecera = Math.max(10, 4 + lineasTitulo.length * 3.2);

            pdf.setFillColor(...negro);
            pdf.rect(offsetXDerecha, offsetYDerecha, anchoCredencial, altoCabecera, 'F');
            pdf.setDrawColor(...azul);
            pdf.setLineWidth(0.6);
            //pdf.rect(offsetXDerecha, offsetYDerecha, anchoCredencial, altoCredencial, 'S');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            let yTitulo = offsetYDerecha + altoCabecera / 2 - (lineasTitulo.length - 1) * 1.6 + 1;
            lineasTitulo.forEach((line: string) => {
                pdf.text(line, centroX, yTitulo, { align: 'center' });
                yTitulo += 3.2;
            });
            pdf.setTextColor(255, 255, 255);

            let yRev = offsetYDerecha + altoCabecera + 6;

            const separador = () => {
                pdf.setDrawColor(...negro);
                pdf.setLineWidth(0.4);
                pdf.line(izqX, yRev, izqX + anchoUtil, yRev);
                yRev += 5;
            };

            const bloque = (etiqueta: string, valores: string[]) => {
                pdf.setTextColor(...negro);
                pdf.setFontSize(6.5);
                pdf.setFont('helvetica', 'bold');
                pdf.text(etiqueta, izqX, yRev);
                yRev += 3.4;
                pdf.setTextColor(40, 40, 40);
                pdf.setFontSize(6);
                pdf.setFont('helvetica', 'normal');
                valores.forEach((valor) => {
                    pdf.splitTextToSize(valor, anchoUtil).forEach((line: string) => {
                        pdf.text(line, izqX, yRev);
                        yRev += 2.8;
                    });
                });
                yRev += 1.8;
            };

            bloque('Año de Admisión:', [anioAdmision]);
            separador();
            bloque('Dirección:', direccionLineas);
            separador();

            // Píldora IMPORTANTE
            const anchoPildora = 24;
            pdf.setFillColor(...negro);
            pdf.roundedRect(centroX - anchoPildora / 2, yRev, anchoPildora, 5, 2.5, 2.5, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(6.5);
            pdf.setFont('helvetica', 'bold');
            pdf.text('IMPORTANTE', centroX, yRev + 3.4, { align: 'center' });
            yRev += 10;

            // Avisos con ícono circular
            const radioIcono = 2.6;
            const cxIcono = izqX + radioIcono;
            const xTextoAviso = izqX + radioIcono * 2 + 3.5;
            const anchoTextoAviso = anchoUtil - (radioIcono * 2 + 3.5);

            avisos.forEach((aviso, idx) => {
                pdf.setFontSize(5.5);
                pdf.setFont('helvetica', 'normal');
                const lineas = pdf.splitTextToSize(aviso.texto, anchoTextoAviso);
                const altoBloque = Math.max(radioIcono * 2 + 1.5, lineas.length * 2.6 + 1.5);
                const cy = yRev + altoBloque / 2;

                pdf.setFillColor(...negro);
                pdf.circle(cxIcono, cy, radioIcono, 'F');
                pdf.setFillColor(255, 255, 255);
                if (aviso.icono === 'persona') {
                    pdf.circle(cxIcono, cy - 0.7, 0.75, 'F');
                    pdf.roundedRect(cxIcono - 1.15, cy + 0.2, 2.3, 1.2, 0.6, 0.6, 'F');
                } else if (aviso.icono === 'ubicacion') {
                    pdf.circle(cxIcono, cy - 0.6, 0.9, 'F');
                    pdf.triangle(cxIcono - 0.8, cy + 0.1, cxIcono + 0.8, cy + 0.1, cxIcono, cy + 1.6, 'F');
                } else {
                    pdf.circle(cxIcono - 0.55, cy - 0.5, 0.6, 'F');
                    pdf.circle(cxIcono + 0.55, cy - 0.5, 0.6, 'F');
                    pdf.triangle(cxIcono - 1.13, cy - 0.25, cxIcono + 1.13, cy - 0.25, cxIcono, cy + 1.5, 'F');
                }

                // Línea vertical separadora
                pdf.setDrawColor(...negro);
                pdf.setLineWidth(0.35);
                pdf.line(xTextoAviso - 1.8, yRev + 0.5, xTextoAviso - 1.8, yRev + altoBloque - 0.5);

                pdf.setTextColor(60, 60, 60);
                let yTextoAviso = cy - ((lineas.length - 1) * 2.6) / 2 + 0.6;
                lineas.forEach((line: string) => {
                    pdf.text(line, xTextoAviso, yTextoAviso);
                    yTextoAviso += 2.6;
                });

                yRev += altoBloque;
                if (idx < avisos.length - 1) {
                    pdf.setDrawColor(220, 220, 220);
                    pdf.setLineWidth(0.25);
                    pdf.line(izqX, yRev, izqX + anchoUtil, yRev);
                    yRev += 1.5;
                }
            });

            const pdfBlob = pdf.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const newWindow = window.open(pdfUrl, '_blank');
            if (newWindow) {
                setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
            } else {
                pdf.save(`carnet_${nombreCompleto.replace(/\s/g, '_')}.pdf`);
            }
        } catch (error) {
            console.error('Error al generar carnet:', error);
        }
    };

    const imageSrc = getImageSrc();

    return (
        <div className="bg-gradient-to-br from-gray-100 to-gray-200 py-8 px-4">
            <div className="flex justify-end mb-6">
                <button
                    onClick={imprimirFotocheck}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Ver / Imprimir Carnet
                </button>
            </div>

            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                {/* Frente — CARNET COMUNERO */}
                <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-blue-600 h-full flex flex-col">
                    <div className="bg-blue-600 py-4 px-6">
                        <h1 className="text-white text-center font-bold text-xl tracking-wide">{nombreComunidad || "Comunidad"}</h1>
                    </div>
                    <div className="p-6 flex flex-col items-center space-y-4 flex-1">
                        {/* 168px = 50% más que los 112px (w-28) originales */}
                        <div className="w-[198px] h-[198px] bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-300">
                            {imageSrc ? (
                                <img src={imageSrc} alt={nombreCompleto} className="w-full h-full object-contain" />
                            ) : (
                                <svg className="w-24 h-24 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            )}
                        </div>
                        <div className="text-center space-y-1">
                            <h2 className="text-base font-bold text-gray-900 uppercase">{nombreCompleto}</h2>
                            <p className="text-sm text-gray-600">DNI: {dni}</p>
                            {domicilio && <p className="text-sm text-gray-600 uppercase">{domicilio}</p>}
                            {nombreCaserio && <p className="text-sm text-gray-600 uppercase">{nombreCaserio}</p>}
                            {/* {nombreComunidad && <p className="text-sm font-semibold text-gray-700 uppercase">{nombreComunidad}</p>}
                            <p className="text-sm text-gray-800">
                                <span className="font-bold">AÑO DE AFILIACIÓN:</span> {fechaAdmision}
                            </p> */}
                        </div>
                        <div ref={qrRef} className="bg-white p-3 rounded-lg border-2 border-gray-200">
                            <QRCodeSVG value={hashQr || "N/A"} size={110} level="H" />
                        </div>
                        {/* <div className="bg-green-500 text-white px-8 py-2 rounded-full font-semibold text-sm shadow-lg">
                            Autorizado
                        </div> */}
                    </div>
                </div>

                {/* Reverso */}
                <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-blue-600 h-full flex flex-col">
                    <div className="bg-blue-600 py-5 px-6">
                        <h1 className="text-white text-center font-bold text-xl leading-tight tracking-wide uppercase">
                            {nombreComunidad || "COMUNIDAD CAMPESINA"}
                        </h1>
                    </div>
                    <div className="p-6 flex-1 flex flex-col gap-4">
                        <div>
                            <p className="text-sm font-bold text-blue-800">Año de Admisión:</p>
                            <p className="text-sm text-gray-800 mt-1">{anioAdmision}</p>
                        </div>
                        <hr className="border-t-2 border-blue-600" />
                        <div>
                            <p className="text-sm font-bold text-blue-800">Dirección:</p>
                            {direccionLineas.map((linea, i) => (
                                <p key={i} className="text-sm text-gray-800 mt-1">{linea}</p>
                            ))}
                        </div>
                        <hr className="border-t-2 border-blue-600" />
                        <div className="flex justify-center">
                            <span className="bg-blue-600 text-white px-8 py-1.5 rounded-full font-bold text-sm tracking-wide">
                                IMPORTANTE
                            </span>
                        </div>
                        <ul className="flex flex-col divide-y divide-gray-200">
                            {avisos.map((aviso, i) => (
                                <li key={i} className="flex items-center gap-4 py-3">
                                    <IconoAviso tipo={aviso.icono} />
                                    <div className="border-l-2 border-blue-600 self-stretch" />
                                    <p className="text-sm text-gray-700 leading-snug">{aviso.texto}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// DocumentosComunero
// ============================================================
interface DocumentoComunero {
    id: number;
    documento_id: number;
    nombre_documento: string;
    url_documento: string | null;
    aprobador: string | null;
    fecha_aprobacion: string | null;
    fecha_subida: string | null;
    estado_aprobacion: string | number | null;
    comentario_aprobacion: string | null;
    comunero_id: number;
    estado: string | null;
}

const DocumentosComunero: React.FC<{ comunero: any[] }> = ({ comunero }) => {
    const [selectedComunero, setSelectedComunero] = useState<any | null>(null);
    const [documentos, setDocumentos] = useState<DocumentoComunero[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [uploading, setUploading] = useState<number | null>(null);
    const [approving, setApproving] = useState<number | null>(null);
    const [downloading, setDownloading] = useState<number | null>(null);
    const [printingFotocheck, setPrintingFotocheck] = useState(false);
    const [showFotocheck, setShowFotocheck] = useState(false);
    const [fotocheckData, setFotocheckData] = useState<any>(null);
    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // El SearchPanel sólo puede filtrar columnas con dataField: se precalculan
    // el nombre completo y el DNI como texto para que sean buscables.
    const comunerosData = useMemo(
        () =>
            (comunero ?? []).map((c: any) => ({
                ...c,
                nombre_completo: `${c.nombres ?? ""} ${c.ape_pat ?? ""} ${c.ape_mat ?? ""}`.replace(/\s+/g, " ").trim(),
                dni: c.dni != null ? String(c.dni) : "",
            })),
        [comunero]
    );

    // Nombre completo del comunero abierto (incluye apellido materno)
    const nombreSeleccionado = useMemo(() => {
        if (!selectedComunero) return "";
        return (
            selectedComunero.nombre_completo ||
            `${selectedComunero.nombres ?? ""} ${selectedComunero.ape_pat ?? ""} ${selectedComunero.ape_mat ?? ""}`
        )
            .replace(/\s+/g, " ")
            .trim();
    }, [selectedComunero]);

    const todosAprobados = documentos.length > 0 && documentos.every(d => d.estado_aprobacion !== null);

    const handleImprimirFotocheck = async () => {
        setPrintingFotocheck(true);
        try {
            const res = await apiManager.comunero.imprimirFotocheck({ comunero_id: selectedComunero?.id });
            const comuneroData = res?.data?.comunero;
            if (!comuneroData) {
                notify("No se encontraron datos del comunero", "warning", 3000);
                return;
            }
            let fotoBase64 = "";
            if (comuneroData.foto_url) {
                try {
                    const fotoRes = await apiManager.auth.getFoto({ fotoUrl: comuneroData.foto_url });
                    fotoBase64 = fotoRes?.value?.foto_base64 || "";
                    //console.log("Foto base64 obtenida:", fotoBase64 ? "Sí" : "No", fotoBase64);
                } catch { /* continúa sin foto */ }
            }
            setFotocheckData({ ...comuneroData, fotoBase64 });
            setShowFotocheck(true);
        } catch {
            notify("Error al generar fotocheck", "error", 3000);
        } finally {
            setPrintingFotocheck(false);
        }
    };

    const openDocumentos = async (com: any) => {
        setSelectedComunero(com);
        setDocumentos([]);
        setLoadingDocs(true);
        try {
            const res = await apiManager.comunero.listarDocumentos({ comunero_id: com.id });
            setDocumentos(res?.data ?? []);
        } catch {
            notify("Error al cargar documentos", "error", 3000);
        } finally {
            setLoadingDocs(false);
        }
    };

    const handleFileChange = async (doc: DocumentoComunero, file: File) => {
        setUploading(doc.documento_id);
        try {
            const formData = new FormData();
            formData.append("comunero_id", String(selectedComunero?.id ?? 0));
            formData.append("documento_id", String(doc.documento_id));
            formData.append("file", file);
            const res = await apiManager.comunero.insertarDocumento(formData);
            if (res?.code === 200) {
                notify("Archivo subido correctamente", "success", 3000);
                const updated = await apiManager.comunero.listarDocumentos({ comunero_id: selectedComunero?.id });
                setDocumentos(updated?.data ?? []);
            } else {
                notify(res?.message ?? "Error al subir archivo", "error", 3000);
            }
        } catch {
            notify("Error al subir archivo", "error", 3000);
        } finally {
            setUploading(null);
        }
    };

    const handleAprobar = (doc: DocumentoComunero) => {
        const usuarioRaw = localStorage.getItem("usuarioCookie");
        const usuarioParsed = usuarioRaw ? JSON.parse(usuarioRaw) : {};
        let comentario = "";
        const dialog = custom({
            title: "Aprobar documento",
            messageHtml: `
                <div class="space-y-3">
                    <p>¿Aprobar <strong>${doc.nombre_documento}</strong>?</p>
                    <label class="block text-sm font-medium mt-2">Comentario:</label>
                    <textarea id="comentarioAprobInput" rows="3" class="w-full border rounded px-2 py-1" placeholder="Escriba un comentario..."></textarea>
                </div>
            `,
            buttons: [
                {
                    text: "Aprobar",
                    onClick: async () => {
                        const el = document.getElementById("comentarioAprobInput") as HTMLTextAreaElement;
                        comentario = el?.value.trim() || "";
                        setApproving(doc.id);
                        try {
                            const res = await apiManager.comunero.aprobarDocumento({
                                id: doc.id,
                                estado_aprobacion: 1,
                                aprobador: usuarioParsed.username || "admin",
                                comentario_aprobacion: comentario,
                            });
                            if (res?.code === 200) {
                                notify("Documento aprobado correctamente", "success", 3000);
                                const updated = await apiManager.comunero.listarDocumentos({ comunero_id: selectedComunero?.id });
                                setDocumentos(updated?.data ?? []);
                            } else {
                                notify(res?.message ?? "Error al aprobar documento", "error", 3000);
                            }
                        } catch {
                            notify("Error al aprobar documento", "error", 3000);
                        } finally {
                            setApproving(null);
                        }
                        return true;
                    },
                    stylingMode: "contained",
                    type: "success",
                },
                {
                    text: "Cancelar",
                    onClick: () => false,
                    stylingMode: "outlined",
                    type: "normal",
                },
            ],
        });
        dialog.show();
    };

    const renderAccionesComunero = (data: any) => (
        <Button
            text="Ver documentos"
            type="default"
            stylingMode="contained"
            onClick={() => openDocumentos(data.row.data)}
        />
    );

    const renderFecha = (field: "fecha_subida" | "fecha_aprobacion") => (data: any) => {
        const val = data.row.data[field];
        return val ? moment(val).format("DD/MM/YYYY") : "—";
    };

    const renderEstado = (data: any) => {
        const raw = data.value;
        if (raw === null || raw === undefined || raw === "") return <span className="text-gray-400 text-xs">—</span>;
        if (raw === 1 || raw === "1") {
            return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Aprobado</span>;
        }
        const label = String(raw);
        const map: Record<string, string> = {
            aprobado: "bg-green-100 text-green-700",
            rechazado: "bg-red-100 text-red-700",
            pendiente: "bg-yellow-100 text-yellow-700",
        };
        const cls = map[label.toLowerCase()] ?? "bg-gray-100 text-gray-600";
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
    };

    const renderDescargar = (data: any) => {
        const doc: DocumentoComunero = data.row.data;
        const handleDescargar = async () => {
            setDownloading(doc.id);
            try {
                const { blob } = await apiManager.comunero.descargarDocumento({ id_documento: doc.id });
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, "_blank");
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
            } catch {
                notify("Error al descargar el documento", "error", 3000);
            } finally {
                setDownloading(null);
            }
        };
        return (
            <Button
                text={downloading === doc.id ? "Descargando…" : "Descargar"}
                icon="download"
                type="normal"
                stylingMode="outlined"
                disabled={downloading === doc.id}
                onClick={handleDescargar}
            />
        );
    };

    const renderAccionesDoc = (data: any) => {
        const doc: DocumentoComunero = data.row.data;
        return (
            <div className="flex gap-1">
                <input
                    type="file"
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[doc.documento_id] = el; }}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileChange(doc, file);
                        e.target.value = "";
                    }}
                />
                <Button
                    text={uploading === doc.documento_id ? "Subiendo…" : doc.url_documento ? "Reemplazar" : "Cargar"}
                    type="default"
                    stylingMode="outlined"
                    disabled={uploading === doc.documento_id}
                    onClick={() => fileInputRefs.current[doc.documento_id]?.click()}
                />
                <Button
                    text={approving === doc.id ? "Aprobando…" : "Aprobar"}
                    type="success"
                    stylingMode="outlined"
                    disabled={approving === doc.id || doc.estado_aprobacion === 1 || doc.estado_aprobacion === "1" || !doc.url_documento}
                    onClick={() => handleAprobar(doc)}
                />
            </div>
        );
    };

    return (
        <>
            {/* DataGrid comuneros */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <DataGrid
                    dataSource={comunerosData}
                    keyExpr="id"
                    showBorders
                    rowAlternationEnabled
                    columnAutoWidth
                >
                    <SearchPanel visible width={240} placeholder="Buscar comunero..." highlightCaseSensitive={false} />
                    <Paging enabled pageSize={10} />
                    <Column dataField="nombre_completo" caption="Nombres" dataType="string" minWidth={200} />
                    <Column dataField="dni" caption="DNI" dataType="string" width={130} alignment="center" />
                    <Column caption="Acciones" width={160} alignment="center" cellRender={renderAccionesComunero} allowSorting={false} allowFiltering={false} allowSearch={false} />
                </DataGrid>
            </div>

            {/* Popup documentos */}
            <Popup
                visible={!!selectedComunero}
                onHiding={() => setSelectedComunero(null)}
                showCloseButton
                dragEnabled
                resizeEnabled
                width="95vw"
                maxWidth={1300}
                height="85vh"
                title={selectedComunero ? `Documentos — ${nombreSeleccionado}` : ""}
                wrapperAttr={{ class: "documentos-comunero-popup" }}
            >
                <div className="p-4 flex flex-col gap-4">
                    {loadingDocs ? (
                        <div className="py-10 text-center text-gray-400">Cargando documentos…</div>
                    ) : (
                        <>
                            <DataGrid
                                dataSource={documentos}
                                keyExpr="documento_id"
                                showBorders
                                rowAlternationEnabled
                                columnAutoWidth
                            >
                                <SearchPanel visible width={240} placeholder="Buscar documento..." />
                                <Paging enabled pageSize={10} />
                                <Column dataField="nombre_documento" caption="Documento" minWidth={180} />
                                <Column dataField="fecha_subida" caption="Fecha subida" width={130} alignment="center" cellRender={renderFecha("fecha_subida")} />
                                <Column dataField="fecha_aprobacion" caption="Fecha aprobación" width={150} alignment="center" cellRender={renderFecha("fecha_aprobacion")} />
                                <Column dataField="estado_aprobacion" caption="Estado" width={120} alignment="center" cellRender={renderEstado} />
                                <Column caption="Descargar" width={130} alignment="center" cellRender={renderDescargar} allowSorting={false} allowFiltering={false} allowSearch={false} />
                                <Column caption="Acciones" width={230} alignment="center" cellRender={renderAccionesDoc} allowSorting={false} allowFiltering={false} allowSearch={false} />
                            </DataGrid>
                            <div className="flex justify-end">
                                <Button
                                    text={printingFotocheck ? "Generando…" : "Imprimir fotocheck"}
                                    icon="print"
                                    type="success"
                                    stylingMode="contained"
                                    disabled={!todosAprobados || printingFotocheck}
                                    onClick={handleImprimirFotocheck}
                                    hint={!todosAprobados ? "Todos los documentos deben estar aprobados" : undefined}
                                />
                            </div>
                        </>
                    )}
                </div>
            </Popup>

            {/* Popup fotocheck */}
            <Popup
                visible={showFotocheck}
                onHiding={() => { setShowFotocheck(false); setFotocheckData(null); }}
                showCloseButton
                dragEnabled
                resizeEnabled
                width="90vw"
                maxWidth={1100}
                height="85vh"
                title={fotocheckData ? `Fotocheck — ${fotocheckData.nombres_completos ?? ""}` : "Fotocheck"}
                wrapperAttr={{ class: "fotocheck-comunero-popup" }}
            >
                <div className="h-full overflow-y-auto">
                    {fotocheckData && (
                        <FotocheckComuneroCard
                            nombreCompleto={fotocheckData.nombres_completos ?? ""}
                            dni={fotocheckData.dni ?? ""}
                            fechaAdmision={fotocheckData.fecha_admision ?? ""}
                            hashQr={fotocheckData.hash_qr ?? ""}
                            fotoBase64={fotocheckData.fotoBase64 ?? ""}
                            domicilio={fotocheckData.domicilio ?? null}
                            nombreCaserio={fotocheckData.nombre_caserio ?? null}
                            nombreComunidad={fotocheckData.nombre_comunidad ?? null}
                        />
                    )}
                </div>
            </Popup>
        </>
    );
};

// ============================================================
// EmptyState
// ============================================================
const EmptyState: React.FC<{ title?: string; subtitle?: string }> = ({
    title = "Navega en las opciones disponibles",
    subtitle = "Usa el ícono del menú arriba a la izquierda para elegir una sección",
}) => (
    <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
                <IconMenu />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
            <p className="mt-2 text-gray-500">{subtitle}</p>
        </div>
    </div>
);

// ============================================================
// ComunerosCRUD
// ============================================================
const ComunerosCRUD: React.FC = () => {
    const { comunero, addComunero, updateComunero, deleteComunero, getComuneroById, fetchAll, comunidades, caserios, parentescos, getFamiliares, addFamiliar, updateFamiliar, deleteFamiliar } = useComunero();
    const [showForm, setShowForm] = useState(false);
    const [editingComunero, setEditingComunero] = useState<Comunero | null>(null);
    const [activeView, setActiveView] = useState<"empty" | "comuneros" | "reporte" | "documentos">("empty");
    const [selectedComunidad, setSelectedComunidad] = useState<number | null>(null);
    const menuItems: NavItem[] = [
        { text: "Comuneros", onClick: () => setActiveView("comuneros") },
        { text: "Documentos", onClick: () => setActiveView("documentos") },
    ];

    const handleAdd = () => {
        setEditingComunero(null);
        setShowForm(true);
    };

    const handleEdit = (comunero: Comunero) => {
        setEditingComunero(comunero);
        setShowForm(true);
    };

    const [maestros, setMaestros] = useState<any>({
        areas: [],
        subAreas: [],
        puestos: [],
        empresas: [],
        tipoComunero: [],
        guardias: [],
        estadosCiviles: [],
        sistemaTrabajo: [],
        regimenes: [],
        tipoDocumentos: [],
        motivoCese: [],
        tipoExamen: []
    });

    useEffect(() => {
        fetchMaestros().then(setMaestros);
    }, []);

    const handleDelete = (id: number) => {
        const usuarioRaw = localStorage.getItem("usuarioCookie");
        const usuarioParsed = usuarioRaw ? JSON.parse(usuarioRaw) : {};
        const comuneroToDelete = getComuneroById(id);
        if (!comuneroToDelete) return;
        let comentarioCese = "";
        const dialog = custom({
            title: "Confirmar Eliminar de Comunero",
            messageHtml: `
        <div class="space-y-4">
            <p>¿Está seguro de elimar a <strong>${comuneroToDelete.nombres} ${comuneroToDelete.ape_pat}</strong>?</p>
            <p>La acción no se puede deshacer.</p>
            <label class="block text-sm font-medium mt-2">Comentario:</label>
            <textarea id="comentarioCeseInput" rows="3" class="w-full border rounded px-2 py-1" placeholder="Escriba un comentario..."></textarea>
        </div>
    `,
            buttons: [
                {
                    text: "Eliminar",
                    onClick: () => {
                        const commentEl = document.getElementById("comentarioCeseInput") as HTMLTextAreaElement;
                        comentarioCese = commentEl?.value.trim() || "";
                        deleteComunero(id, { usuarioDelete: usuarioParsed.username || 'admin', comentarioDelete: comentarioCese });
                        return true;
                    },
                    stylingMode: "contained",
                    type: "danger",
                },
                {
                    text: "Cancelar",
                    onClick: () => false,
                    stylingMode: "outlined",
                    type: "normal",
                },
            ],
        });
        dialog.show();
    };

    const handleSubmit = (data: ComuneroFormData) => {
        if (editingComunero?.id !== undefined && !isNaN(Number(editingComunero.id))) {
            updateComunero(Number(editingComunero.id), data);
        } else {
            addComunero(data);
        }
        setShowForm(false);
        setEditingComunero(null);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingComunero(null);
    };

    useEffect(() => {
        if (comunidades.length > 0 && selectedComunidad === null) {
            setSelectedComunidad(comunidades[0].id);
        }
    }, [comunidades]);

    useEffect(() => {
        if (selectedComunidad !== null) fetchAll(selectedComunidad);
    }, [selectedComunidad]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                {/* Encabezado y botón */}
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <NavDropdown id="nav-comunero" items={menuItems} />
                        {activeView !== "empty" && (
                            <h1 className="text-lg sm:text-xl font-semibold text-gray-800">
                                {activeView === "comuneros" ? "Lista Comunero" : activeView === "documentos" ? "Documentos Comunero" : ""}
                            </h1>
                        )}
                    </div>
                    {activeView === "comuneros" && (
                        <Button
                            type="default"
                            stylingMode="contained"
                            text="Agregar Comunero"
                            onClick={handleAdd}
                        />
                    )}
                </div>

                {/* Selector de comunidad */}
                {activeView !== "empty" && (
                    <div className="mb-4 flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">Comunidad:</span>
                        <SelectBox
                            dataSource={comunidades}
                            displayExpr="nombre"
                            valueExpr="id"
                            value={selectedComunidad}
                            onValueChanged={(e) => setSelectedComunidad(e.value)}
                            placeholder="Seleccione comunidad..."
                            width={260}
                        />
                    </div>
                )}

                {/* Vistas */}
                {activeView === "empty" && <EmptyState />}
                {activeView === "comuneros" && (
                    <ComuneroList
                        comunero={comunero}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onAdd={handleAdd}
                    />
                )}
                {activeView === "documentos" && (
                    <DocumentosComunero comunero={comunero} />
                )}

                {/* Popup formulario comunero */}
                <Popup
                    visible={showForm}
                    onHiding={() => setShowForm(false)}
                    showCloseButton
                    dragEnabled
                    resizeEnabled
                    width="90vw"
                    maxWidth={1200}
                    height="auto"
                    maxHeight="90vh"
                    wrapperAttr={{ class: "comunero-form-popup" }}
                >
                    <div className="max-h-[80vh] overflow-y-auto p-4">
                        <ComuneroForm
                            comunero={editingComunero || undefined}
                            onSubmit={handleSubmit}
                            onCancel={handleCancel}
                            isEditing={!!editingComunero}
                            listaComunidades={comunidades || []}
                            listaCaserios={caserios || []}
                            listaEstadoCivil={maestros.estadoCivil || []}
                            parentescos={parentescos}
                            getFamiliares={getFamiliares}
                            addFamiliar={addFamiliar}
                            updateFamiliar={updateFamiliar}
                            deleteFamiliar={deleteFamiliar}
                        />
                    </div>
                </Popup>
            </div>
        </div>
    );
};

export default ComunerosCRUD;
