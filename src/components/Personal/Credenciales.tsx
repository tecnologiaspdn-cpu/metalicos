import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import miLogo from '../../assets/solo-logo.png';

interface ExamenRealizado {
    tipo: string;
    fecha?: string;
    descripcion?: string; // Agregado para mostrar la descripción del examen
}

interface Capacitacion {
    nombre: string;
    fecha?: string;
}

interface VirtualCredentialProps {
    nombre: string;
    cargo: string;
    departamento: string;
    empresa: string;
    qrData: string;
    fotoUrl?: string;
    autorizado?: boolean;
    fotoBase64?: string;
    fechaVencimiento: string;
    examenesRealizados?: ExamenRealizado[];
    capacitaciones?: Capacitacion[];
}

const Credenciales: React.FC<VirtualCredentialProps> = ({
    nombre,
    cargo,
    departamento,
    empresa,
    qrData,
    fotoUrl,
    autorizado = true,
    fotoBase64,
    fechaVencimiento,
    examenesRealizados = [],
    capacitaciones = []
}) => {
    //console.log("examenesRealizados", examenesRealizados)
    const qrRef = useRef<HTMLDivElement>(null);
    const credencialFrenteRef = useRef<HTMLDivElement>(null);
    const credencialReversoRef = useRef<HTMLDivElement>(null);

    // FLAG: Cambia esto para controlar el comportamiento
    // true = descarga automática | false = abre en nueva pestaña
    const AUTO_DESCARGAR = false;

    const getImageSrc = (): string | undefined => {
        if (!fotoBase64) return undefined;

        if (fotoBase64.startsWith('data:image')) {
            return fotoBase64;
        }

        return `data:image/jpeg;base64,${fotoBase64}`;
    };

    const isVencido2 = (): boolean => {
        //converitr a fechaVencimiento a formato YYYY-MM-DD para evitar problemas de formato ya que viene como DD/MM/YYYY 
        let fecha_vencimiento = fechaVencimiento.split('/').reverse().join('-');
        console.log("fechaVencimiento original", fechaVencimiento);
        const fechaActual = new Date();
        const fechaVenc = new Date(fecha_vencimiento);
        console.log("fechaActual", fechaActual);
        console.log("fechaVenc", fechaVenc);
        return fechaActual > fechaVenc;
    };
    const isVencido = (): boolean => {
        // Parsear manualmente la fecha en formato DD/MM/YYYY
        const [dia, mes, anio] = fechaVencimiento.split('/').map(Number);
        // new Date(año, mesIndex, día) → mesIndex empieza en 0
        const fechaVenc = new Date(anio, mes - 1, dia);

        console.log("fechaVencimiento original", fechaVencimiento);
        const fechaActual = new Date();
        console.log("fechaActual", fechaActual);
        console.log("fechaVenc", fechaVenc);

        return fechaActual > fechaVenc;
    };

    const formatearFecha = (fecha: string): string => {
        const date = new Date(fecha);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const splitText = (text: string, maxWidth: number, pdf: jsPDF): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const width = pdf.getTextWidth(testLine);

            if (width > maxWidth) {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) lines.push(currentLine);
        return lines;
    };

    const imprimirCredencialSinMargen = async () => {
        try {
            // Dimensiones en mm
            const anchoMM = 55;
            const altoMM = 85;
            const margen = 0.3;

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [anchoMM, altoMM]
            });

            // Colores
            const amarillo = [250, 204, 21];
            const verde = [34, 197, 94];
            const rojo = [239, 68, 68];
            const azul = [0, 102, 204]; // RGB

            // ==================== PÁGINA 1: FRENTE ====================

            // Header amarillo
            pdf.setFillColor(amarillo[0], amarillo[1], amarillo[2]);
            pdf.rect(0, 0, anchoMM, 10, 'F');

            // Borde azul 
            pdf.setDrawColor(azul[0], azul[1], azul[2]);
            pdf.setLineWidth(0.6); // grosor del borde 
            pdf.rect(0, 0, anchoMM, altoMM, 'S');

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text('CREDENCIAL PERSONAL', anchoMM / 2, 6, { align: 'center' });

            let yPos = 12;

            // Foto (círculo simulado con cuadrado)
            const fotoSize = 18;
            const fotoX = anchoMM / 2 - fotoSize / 2;

            if (imageSrc) {
                try {
                    // Dibujar círculo blanco de fondo
                    pdf.setFillColor(255, 255, 255);
                    pdf.circle(anchoMM / 2, yPos + fotoSize / 2, fotoSize / 2 + 0.5, 'F');

                    // Agregar imagen
                    pdf.addImage(imageSrc, 'JPEG', fotoX, yPos, fotoSize, fotoSize);
                } catch (e) {
                    console.log('No se pudo agregar la foto');
                }
            }

            yPos += fotoSize + 4;

            // Información personal
            pdf.setTextColor(0, 0, 0);

            // Nombre
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'bold');
            const nombreLines = splitText(nombre, anchoMM - 2 * margen, pdf);
            nombreLines.forEach(line => {
                pdf.text(line, anchoMM / 2, yPos, { align: 'center' });
                yPos += 3;
            });

            // Cargo
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'normal');
            const cargoLines = splitText(cargo, anchoMM - 2 * margen, pdf);
            cargoLines.forEach(line => {
                pdf.text(line, anchoMM / 2, yPos, { align: 'center' });
                yPos += 2.5;
            });

            // Departamento
            const deptoLines = splitText(departamento, anchoMM - 2 * margen, pdf);
            deptoLines.forEach(line => {
                pdf.text(line, anchoMM / 2, yPos, { align: 'center' });
                yPos += 2.5;
            });

            // Empresa
            pdf.setFont('helvetica', 'bold');
            const empresaLines = splitText(empresa, anchoMM - 2 * margen, pdf);
            empresaLines.forEach(line => {
                pdf.text(line, anchoMM / 2, yPos, { align: 'center' });
                yPos += 2.5;
            });

            // Fecha de vencimiento
            yPos += 1;
            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Fecha de vencimiento:', anchoMM / 2, yPos, { align: 'center' });
            yPos += 2.5;
            pdf.setFont('helvetica', 'normal');
            //pdf.text(formatearFecha(fechaVencimiento), anchoMM / 2, yPos, { align: 'center' });
            pdf.text((fechaVencimiento), anchoMM / 2, yPos, { align: 'center' });

            yPos += 3;

            // QR Code
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

                            const qrSize = 18;
                            const qrX = anchoMM / 2 - qrSize / 2;

                            try {
                                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', qrX, yPos, qrSize, qrSize);
                            } catch (e) {
                                console.log('Error al agregar QR');
                            }
                            resolve();
                        };
                        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                    });
                }
            }

            // Badge al final
            const badgeY = altoMM - 6;
            const vencido = isVencido();

            if (autorizado && !vencido) {
                pdf.setFillColor(verde[0], verde[1], verde[2]);
                pdf.roundedRect(anchoMM / 2 - 12, badgeY - 2.5, 24, 5, 2.5, 2.5, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(6);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Autorizado', anchoMM / 2, badgeY, { align: 'center' });
            } else if (vencido) {
                pdf.setFillColor(rojo[0], rojo[1], rojo[2]);
                pdf.roundedRect(anchoMM / 2 - 12, badgeY - 2.5, 24, 5, 2.5, 2.5, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(6);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Vencido', anchoMM / 2, badgeY, { align: 'center' });
            }

            // ==================== PÁGINA 2: REVERSO ====================
            pdf.addPage();


            // Header amarillo
            pdf.setFillColor(amarillo[0], amarillo[1], amarillo[2]);
            pdf.rect(0, 0, anchoMM, 10, 'F');

            // Borde azul 
            pdf.setDrawColor(azul[0], azul[1], azul[2]);
            pdf.setLineWidth(0.6);
            pdf.rect(0, 0, anchoMM, altoMM, 'S');

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text('CREDENCIAL PERSONAL', anchoMM / 2, 6, { align: 'center' });

            yPos = 14;

            // Título: Tipo de examen Realizado color negro
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Examen Médico para Trabajo Específico', anchoMM / 2, yPos, { align: 'center' });
            yPos += 4;

            // Lista de exámenes
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'normal');

            if (examenesRealizados.length > 0) {
                examenesRealizados.forEach(examen => {
                    const lineaExamen = `- ${examen.tipo}`;
                    const examenLines = splitText(lineaExamen, anchoMM - 2 * margen, pdf);
                    examenLines.forEach(line => {
                        pdf.text(line, margen + 2, yPos, { align: 'left' });
                        yPos += 2.5;
                    });
                });
            } else {
                pdf.text('- Sin exámenes registrados', margen + 2, yPos, { align: 'left' });
                yPos += 2.5;
            }

            yPos += 2;

            // Línea divisoria
            pdf.setDrawColor(200, 200, 200);
            pdf.line(margen, yPos, anchoMM - margen, yPos);
            yPos += 4;

            // Título: Capacitaciones
            /*pdf.setTextColor(139, 0, 139); // Color púrpura
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Capacitaciones', anchoMM / 2, yPos, { align: 'center' });
            yPos += 4;

            // Lista de capacitaciones
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'normal');

            if (capacitaciones.length > 0) {
                capacitaciones.forEach(capacitacion => {
                    const lineaCap = `- ${capacitacion.nombre}`;
                    const capLines = splitText(lineaCap, anchoMM - 2 * margen, pdf);
                    capLines.forEach(line => {
                        pdf.text(line, margen + 2, yPos, { align: 'left' });
                        yPos += 2.5;
                    });
                });
            } else {
                pdf.text('- Sin capacitaciones registradas', margen + 2, yPos, { align: 'left' });
                yPos += 2.5;
            }*/

            // Decidir si descargar o abrir en nueva pestaña según el flag
            if (AUTO_DESCARGAR) {
                // Descarga automática
                pdf.save(`credencial_${nombre.replace(/\s/g, '_')}.pdf`);
            } else {
                // Abrir en nueva pestaña para vista previa
                const pdfBlob = pdf.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);

                // Abrir en nueva pestaña
                const newWindow = window.open(pdfUrl, '_blank');

                // Limpiar el URL después de un tiempo (opcional)
                if (newWindow) {
                    setTimeout(() => {
                        URL.revokeObjectURL(pdfUrl);
                    }, 100);
                } else {
                    // Si el navegador bloqueó el popup, descargar automáticamente
                    alert('Por favor, permite las ventanas emergentes para ver el PDF. Se descargará automáticamente.');
                    pdf.save(`credencial_${nombre.replace(/\s/g, '_')}.pdf`);
                }
            }

        } catch (error) {
            console.error('Error al generar PDF:', error);
            alert('Error al generar la credencial. Por favor, intente nuevamente.');
        }
    };
    //console.log({ nombre, cargo, departamento, empresa, fechaVencimiento });
    const imprimirCredencial = async () => {
        try {
            // Dimensiones de la hoja A4 en mm
            const anchoA4 = 210;
            const altoA4 = 297;

            // Dimensiones de la credencial
            const anchoCredencial = 53.85;
            const altoCredencial = 85.85;

            // Margen exterior desde el borde de la hoja
            const margenExterior = 0.3;

            // Margen interior para el contenido de la credencial
            const margenInterior = 2;

            // Crear PDF con tamaño A4
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Colores
            const amarillo = [250, 204, 21];
            const verde = [34, 197, 94];
            const rojo = [239, 68, 68];
            const azul = [0, 102, 204];
            const negro = [0, 0, 0]; // Reverso de la credencial

            const imageSrc = getImageSrc();

            // ========== CONFIGURACIÓN DE LA MARCA DE AGUA ==========
            // URL o base64 de la imagen que quieres usar como marca de agua
            const watermarkUrl = miLogo; // REEMPLAZA CON TU IMAGEN

            // Opacidad de la marca de agua (0 = transparente, 1 = opaco)
            const watermarkOpacity = 0.1;

            // Función para agregar marca de agua más grande que cubra foto y QR
            const addWatermark = async (x: number, y: number, width: number, height: number) => {
                if (!watermarkUrl) return;

                try {
                    // Crear un canvas para manejar la opacidad
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();

                    await new Promise<void>((resolve) => {
                        img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx?.drawImage(img, 0, 0);

                            // Aplicar opacidad al canvas
                            if (ctx) {
                                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                const data = imageData.data;
                                for (let i = 3; i < data.length; i += 4) {
                                    data[i] = data[i] * watermarkOpacity;
                                }
                                ctx.putImageData(imageData, 0, 0);
                            }

                            const watermarkDataUrl = canvas.toDataURL('image/png');

                            // TAMAÑO MÁS GRANDE: Ocupa desde debajo del header hasta arriba del badge
                            // Ancho: casi todo el ancho de la credencial (con un pequeño margen)
                            // Alto: desde Y=12mm (después del header) hasta Y=altoCredencial - 12mm (antes del badge)
                            const watermarkWidth = width - (margenInterior * 2) - 3; // 49.85mm aproximadamente
                            const watermarkHeight = (altoCredencial - 42); // Aprox 61.85mm (85.85 - 24)

                            // Posición centrada horizontalmente y verticalmente en el área central
                            const watermarkX = x + (width / 2) - (watermarkWidth / 2);
                            const watermarkY = y + 18; // Comienza después del header (14mm desde arriba)

                            pdf.addImage(watermarkDataUrl, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight + 6);
                            resolve();
                        };
                        img.src = watermarkUrl;
                    });
                } catch (e) {
                    console.log('Error al agregar marca de agua:', e);
                }
            };

            // ==================== PÁGINA 1: FRENTE ====================

            // Posición X, Y para la credencial
            const offsetX = margenExterior;
            const offsetY = margenExterior;

            // Header amarillo
            //pdf.setFillColor(amarillo[0], amarillo[1], amarillo[2]);
            //header negro
            //pdf.setFillColor(negro[0], negro[1], negro[2]);
            //color #FFCB00
            pdf.setFillColor(255, 203, 0);
            pdf.rect(offsetX, offsetY, anchoCredencial, 10, 'F');

            // Borde azul
            //pdf.setDrawColor(azul[0], azul[1], azul[2]);
            //pdf.setLineWidth(0.6);
            //pdf.rect(offsetX, offsetY, anchoCredencial, altoCredencial, 'S'); 
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text('CREDENCIAL PERSONAL', offsetX + anchoCredencial / 2, offsetY + 6, { align: 'center' });

            // Agregar marca de agua DESPUÉS del header pero ANTES de la foto y texto
            // para que quede como fondo pero cubra el área central
            await addWatermark(offsetX, offsetY, anchoCredencial, altoCredencial);

            let yPos = offsetY + 12;

            // Foto
            const fotoSize = 24;
            const fotoX = offsetX + anchoCredencial / 2 - fotoSize / 2;

            if (imageSrc) {
                try {
                    // Fondo blanco para la foto (para que se vea mejor sobre la marca de agua)
                    pdf.setFillColor(255, 255, 255);
                    pdf.rect(fotoX - 0.5, yPos - 0.5, fotoSize + 1, fotoSize + 1, 'F');
                    pdf.addImage(imageSrc, 'JPEG', fotoX, yPos, fotoSize, fotoSize);
                } catch (e) {
                    console.log('No se pudo agregar la foto');
                }
            }

            yPos += fotoSize + 3;

            // Información personal - fondo blanco semi-transparente para mejorar legibilidad
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(255, 255, 255);

            pdf.setTextColor(0, 0, 0);
            // Nombre
            pdf.setFontSize(6.5);
            pdf.setFont('helvetica', 'bold');
            const nombreLines = splitText(nombre, anchoCredencial - margenInterior * 2, pdf);
            nombreLines.forEach(line => {
                pdf.text(line, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
                yPos += 2.8;
            });

            // Cargo
            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'normal');
            const cargoLines = splitText(cargo, anchoCredencial - margenInterior * 2, pdf);
            cargoLines.forEach(line => {
                pdf.text(line, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
                yPos += 2.5;
            });

            // Departamento
            const deptoLines = splitText(departamento, anchoCredencial - margenInterior * 2, pdf);
            deptoLines.forEach(line => {
                pdf.text(line, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
                yPos += 2.5;
            });

            // Empresa
            pdf.setFont('helvetica', 'bold');
            const empresaLines = splitText(empresa, anchoCredencial - margenInterior * 2, pdf);
            empresaLines.forEach(line => {
                pdf.text(line, offsetX + anchoCredencial / 2, yPos, { align: 'center' });
                yPos += 2.5;
            });

            // Fecha de vencimiento
            yPos += 1;
            pdf.setFontSize(5);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Fecha de vencimiento:', offsetX + anchoCredencial / 2, yPos, { align: 'center' });
            yPos += 2.5;
            pdf.setFont('helvetica', 'normal');
            pdf.text(fechaVencimiento, offsetX + anchoCredencial / 2, yPos, { align: 'center' });

            yPos += 3;

            // QR Code - fondo blanco para mejor contraste
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

                            const qrSize = 16;
                            const qrX = offsetX + anchoCredencial / 2 - qrSize / 2;

                            try {
                                // Fondo blanco para el QR
                                pdf.setFillColor(255, 255, 255);
                                pdf.rect(qrX - 1, yPos - 1, qrSize + 2, qrSize + 2, 'F');
                                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', qrX, yPos, qrSize, qrSize);
                            } catch (e) {
                                console.log('Error al agregar QR');
                            }
                            resolve();
                        };
                        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                    });
                }
            }

            // Badge
            const badgeY = offsetY + altoCredencial - 9;
            const vencido = isVencido();

            if (autorizado && !vencido) {
                pdf.setFillColor(verde[0], verde[1], verde[2]);
                pdf.roundedRect(offsetX + anchoCredencial / 2 - 12, badgeY - 2.5, 24, 5, 2.5, 2.5, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(6);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Autorizado', offsetX + anchoCredencial / 2, badgeY, { align: 'center' });
            } else if (vencido) {
                pdf.setFillColor(rojo[0], rojo[1], rojo[2]);
                pdf.roundedRect(offsetX + anchoCredencial / 2 - 12, badgeY - 2.5, 24, 5, 2.5, 2.5, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(6);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Vencido', offsetX + anchoCredencial / 2, badgeY, { align: 'center' });
            }

            // ==================== PÁGINA 2: REVERSO ====================
            pdf.addPage();

            // Posición para la esquina superior derecha
            //const offsetXDerecha = anchoA4 - anchoCredencial - margenExterior;
            const offsetXDerecha = 0.3;
            const offsetYDerecha = margenExterior;

            // Header negro
            pdf.setFillColor(negro[0], negro[1], negro[2]);
            //pdf.setFillColor(255, 203, 0);
            pdf.rect(offsetXDerecha, offsetYDerecha, anchoCredencial, 10, 'F');

            // Borde azul
            //pdf.setDrawColor(azul[0], azul[1], azul[2]);
            //pdf.setLineWidth(0.6);
            //pdf.rect(offsetXDerecha, offsetYDerecha, anchoCredencial, altoCredencial, 'S');

            //pdf.setTextColor(0, 0, 0); 
            //letra blanca
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text('CREDENCIAL PERSONAL', offsetXDerecha + anchoCredencial / 2, offsetYDerecha + 6, { align: 'center' });

            // Agregar marca de agua en el reverso
            await addWatermark(offsetXDerecha, offsetYDerecha, anchoCredencial, altoCredencial);

            let yPosReverso = offsetYDerecha + 14;

            // Título: Tipo de examen Realizado
            pdf.setTextColor(negro[0], negro[1], negro[2]);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Examen Médico para Trabajo Específico', offsetXDerecha + anchoCredencial / 2, yPosReverso, { align: 'center' });
            yPosReverso += 4;

            // Lista de exámenes
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'normal');

            if (examenesRealizados.length > 0) {
                examenesRealizados.forEach(examen => {
                    const lineaExamen = `- ${examen.descripcion}`;
                    const examenLines = splitText(lineaExamen, anchoCredencial - margenInterior * 2, pdf);
                    examenLines.forEach(line => {
                        pdf.text(line, offsetXDerecha + margenInterior, yPosReverso, { align: 'left' });
                        yPosReverso += 2.5;
                    });
                });
            } else {
                pdf.text('- Sin exámenes registrados', offsetXDerecha + margenInterior, yPosReverso, { align: 'left' });
                yPosReverso += 2.5;
            }

            yPosReverso += 2;

            // Línea divisoria
            pdf.setDrawColor(200, 200, 200);
            pdf.line(offsetXDerecha + margenInterior, yPosReverso, offsetXDerecha + anchoCredencial - margenInterior, yPosReverso);

            // Decidir si descargar o abrir en nueva pestaña
            if (AUTO_DESCARGAR) {
                pdf.save(`credencial_${nombre.replace(/\s/g, '_')}.pdf`);
            } else {
                const pdfBlob = pdf.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                const newWindow = window.open(pdfUrl, '_blank');

                if (newWindow) {
                    setTimeout(() => {
                        URL.revokeObjectURL(pdfUrl);
                    }, 100);
                } else {
                    alert('Por favor, permite las ventanas emergentes para ver el PDF. Se descargará automáticamente.');
                    pdf.save(`credencial_${nombre.replace(/\s/g, '_')}.pdf`);
                }
            }

        } catch (error) {
            console.error('Error al generar PDF:', error);
            alert('Error al generar la credencial. Por favor, intente nuevamente.');
        }
    };
    const imageSrc = getImageSrc();
    const vencido = isVencido();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-12 px-4">
            {/* Botón de impresión - Fijo en la esquina superior derecha */}
            <div className="fixed top-20 right-6 z-50">
                <button
                    onClick={imprimirCredencial}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg"
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                    </svg>
                    <span className="hidden sm:inline">
                        {AUTO_DESCARGAR ? 'Descargar Credencial' : 'Ver Credencial'}
                    </span>
                </button>
            </div>

            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Credencial Frente */}
                    <div ref={credencialFrenteRef} className="h-full">
                        {/* <h2 className="text-center text-gray-700 font-semibold mb-4 text-lg">
                            Frente
                        </h2> */}
                        {/* <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden"> */}
                        <div className="w-full bg-white max-w-sm mx-auto rounded-2xl shadow-2xl overflow-hidden border-4 border-blue-500 h-full flex flex-col" >
                            {/* Header */}
                            <div className=" py-4 px-6" style={{ backgroundColor: '#FFCB00 ' }}>
                                <h1 className="text-black text-center font-bold text-xl tracking-wide">
                                    CREDENCIAL PERSONAL
                                </h1>
                            </div>

                            {/* Body */}
                            <div className="p-8 flex flex-col items-center space-y-6">
                                {/* Foto de perfil */}
                                <div className="relative">
                                    <div className="w-28 h-28 bg-gradient-to-br from-black-200 to-black-100 p-1">
                                        <div className="w-full h-full bg-white flex items-center justify-center overflow-hidden">
                                            {imageSrc ? (
                                                <img
                                                    src={imageSrc}
                                                    alt={nombre}
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <svg
                                                    className="w-16 h-16 text-blue-900"
                                                    fill="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Información personal */}
                                <div className="text-center space-y-1">
                                    <h2 className="text-xl font-bold text-gray-900">{nombre}</h2>
                                    <p className="text-sm text-gray-600 font-medium">{cargo}</p>
                                    <p className="text-sm text-gray-600">{departamento}</p>
                                    <p className="text-sm text-gray-700 font-semibold">{empresa}</p>
                                    <p className="text-sm text-gray-800 mt-2">
                                        <span className="font-bold">Fecha de vencimiento:</span>{' '}
                                        {/* {formatearFecha(fechaVencimiento)} */}
                                        {(fechaVencimiento)}
                                    </p>
                                </div>

                                {/* QR Code - Hidden reference for PDF */}
                                <div ref={qrRef} className="bg-white p-4 rounded-lg border-2 border-gray-200">
                                    <QRCodeSVG
                                        value={qrData}
                                        size={120}
                                        level="H"
                                        includeMargin={false}
                                    />
                                </div>

                                {/* Badge de estado */}
                                {autorizado && !vencido && (
                                    <div className="bg-green-500 text-white px-8 py-2 rounded-full font-semibold text-sm shadow-lg">
                                        Autorizado
                                    </div>
                                )}
                                {vencido && (
                                    <div className="bg-red-500 text-white px-8 py-2 rounded-full font-semibold text-sm shadow-lg">
                                        Vencido
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Credencial Reverso */}
                    <div ref={credencialReversoRef} className="h-full">
                        {/* <h2 className="text-center text-gray-700 font-semibold mb-4 text-lg">
                            Reverso 
                        </h2> */}
                        <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-blue-500 h-full flex flex-col">
                            {/* Header */}
                            <div className=" py-4 px-6" style={{ backgroundColor: 'black ' }}>
                                <h1 className="text-white text-center font-bold text-xl tracking-wide">
                                    CREDENCIAL PERSONAL
                                </h1>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-6">
                                {/* Tipo de examen Realizado */}
                                <div>
                                    <h3 className="text-black-700 font-bold text-center text-lg mb-3">
                                        Examen Médico para Trabajo Específico
                                    </h3>
                                    <div className="space-y-1">
                                        {examenesRealizados.length > 0 ? (
                                            examenesRealizados.map((examen, index) => (
                                                <div key={index} className="text-sm text-gray-700">
                                                    <span className="font-semibold">- </span>
                                                    {/* {examen.tipo}  C4AWA3*/}
                                                    {examen.descripcion}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">
                                                - Sin exámenes registrados
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Línea divisoria */}
                                <div className="border-t-2 border-gray-300"></div>

                                {/* Capacitaciones */}
                                {/* <div>
                                    <h3 className="text-purple-700 font-bold text-center text-lg mb-3">
                                        Capacitaciones
                                    </h3>
                                    <div className="space-y-1">
                                        {capacitaciones.length > 0 ? (
                                            capacitaciones.map((capacitacion, index) => (
                                                <div key={index} className="text-sm text-gray-700">
                                                    <span className="font-semibold">- </span>
                                                    {capacitacion.nombre}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">
                                                - Sin capacitaciones registradas
                                            </p>
                                        )}
                                    </div>
                                </div> */}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Credenciales;