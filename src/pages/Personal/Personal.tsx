import React, { useEffect, useMemo, useState } from "react";
import { Popup } from "devextreme-react/popup";
import ContextMenu from "devextreme-react/context-menu";
import SelectBox from "devextreme-react/select-box";
import FileUploader from "devextreme-react/file-uploader";
import Button from "devextreme-react/button";
import Switch from "devextreme-react/switch";
import { custom } from 'devextreme/ui/dialog';
import PersonalList from "../../components/Personal/PersonalList";
import PersonalForm from "../../components/Personal/PersonalForm";
import { usePersonal } from "../../hooks/usePersonal";
import { Personal, PersonalFormData } from "../../types/Personal";
import NavDropdown, { NavItem } from "../../components/NavDropdown";
import { DataGrid, Column, SearchPanel, Paging, Selection, Export, Pager, Toolbar, Item } from 'devextreme-react/data-grid';
import IconMenu from "../../components/Icon/IconMenu";
import DocumentoSubir from "./DocumentoSubir";
import { useMaestros } from "../../hooks/useMaestros";
import { fetchMaestros } from "../../services/maestros/maestros";
import { apiManager } from "../../services/api/ApiManager";
import notify from "devextreme/ui/notify";
import PieChart, { Series, Label, Connector, Legend, Tooltip, Title } from "devextreme-react/pie-chart";
import Chart, {
    Series as CSeries,
    ValueAxis,
    CommonSeriesSettings,
    Tooltip as CTooltip,
    Legend as CLegend
} from "devextreme-react/chart";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import CredencialesPage from "./Credenciales";
import { showMessage } from "../../hooks/useMessage";

// --- Subcomponents
const EmptyState: React.FC<{ title?: string; subtitle?: string }> = ({ title = "Navega en las opciones disponibles", subtitle = "Usa el ícono del menú arriba a la izquierda para elegir una sección", }) => (
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
const DocumentosPanel: React.FC<{ personal: Personal[], listaTipoExamen: any[], refrescar: () => void }> = ({ personal, listaTipoExamen, refrescar }) => {
    const [yaExisteCredenciales, setYaExisteCredenciales] = useState(false);
    const [downloading, setDownloading] = useState(false);
    type PersonaRow = { id: number; nombres: string; area: string; dni: string; puesto: string; };
    type DocumentoRow = {
        id: number;
        url_documento: string | null;
        persona_id: number;
        documento_id: number;
        estado_aprobacion: "0" | "1" | null;
        fecha_subida: string | null;
        nombre_documento: string;
        abre_modal: boolean | string;
        requerido_credencial?: boolean | string;
    };

    // ---- Tabla de Personal con buscador ----
    const [search, setSearch] = useState<string>("");

    const rows: PersonaRow[] = useMemo(() => {
        const base = (personal || []).map((p) => ({
            id: Number(p.id),
            nombres: `${p.nombres} ${p.ape_pat ?? ""} ${p.ape_mat ?? ""}`.trim(),
            area: String(p.area_nombre ?? ""),
            puesto: String(p.puesto_nombre ?? ""),
            dni: p.documento ?? "",
        }));
        if (!search.trim()) return base;
        const q = search.trim().toLowerCase();
        return base.filter(
            (r) =>
                r.nombres.toLowerCase().includes(q) ||
                r.area.toLowerCase().includes(q) ||
                r.dni.toLowerCase().includes(q)
        );
    }, [personal, search]);

    // ---- Modal de documentos ----
    const [showDocs, setShowDocs] = useState(false);
    const [activePersona, setActivePersona] = useState<PersonaRow | null>(null);
    const [docs, setDocs] = useState<DocumentoRow[]>([]);
    const [loading, setLoading] = useState(false);

    // ---- Modal de aprobación/desaprobación ----
    const [showApprovePopup, setShowApprovePopup] = useState(false);
    const [activeDoc, setActiveDoc] = useState<DocumentoRow | null>(null);
    const [comentario, setComentario] = useState("");

    const openDocs = async (persona: PersonaRow) => {
        setYaExisteCredenciales(false);
        setActivePersona(persona);
        setShowDocs(true);
        await fetchDocs(persona.id);
        const existeCredenciales = await (apiManager as any).personal.existeCredenciales({ persona_id: persona?.id });
        if (existeCredenciales?.data[0]?.credencial_activo == "1") {
            setYaExisteCredenciales(true);
        }
    };

    const fetchDocs = async (personaId: number) => {
        setLoading(true);
        try {
            const resp = await (apiManager as any).personal.listarDocumentos({ id: personaId });
            const data: DocumentoRow[] = Array.isArray(resp?.data) ? resp.data : [];
            setDocs(data);
        } catch (e: any) {
            notify(e?.message || "No se pudieron obtener los documentos.", "error", 3500);
            setDocs([]);
        } finally {
            setLoading(false);
        }
    };

    const fechaDisp = (s: string | null) => {
        if (!s) return "—";
        const d = new Date(s.replace(" ", "T"));
        return isNaN(+d) ? "—" : d.toLocaleDateString();
    };

    const estadoBadge = (val: "0" | "1" | null) => {
        if (val === "1")//aprobado
            return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700">Aprobado</span>;
        if (val === "0")//desaprobado
            return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700">Desaprobado</span>;

        //otros caso= pendiente
        return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-yellow-50 text-yellow-700">Pendiente</span>;
    };

    // ---- Subida/actualización de documento ----
    const subirDocumento = async (doc: DocumentoRow, file: File, reemplazar: boolean = false) => {
        if (!activePersona) return notify("No hay persona activa.", "warning", 2500);
        if (!file) return notify("Selecciona un archivo.", "warning", 2500);
        if (reemplazar) { console.log("reemplazar"); }
        try {
            setDownloading(true);
            const formData = new FormData();
            formData.append("personal_id", String(activePersona.id));
            formData.append("documento_id", String(doc.documento_id));
            formData.append("file", file, file.name);
            formData.append("id", reemplazar ? String(doc.id) : "");
            // Si el documento ya existe, llamamos a "actualizar" (mismo endpoint o endpoint similar)
            let endpoint = reemplazar ? "actualizarDocumento" : "insertarDocumento"
            const resp = await (apiManager as any).personal[endpoint](formData);
            if (resp?.code === 200) {
                notify("Archivo subido correctamente.", "success", 2500);
                await fetchDocs(activePersona.id);
            } else {
                notify(resp?.message || "No se pudo subir el archivo.", "error", 3500);
            }
        } catch (e: any) {
            notify(e?.message || "Error al subir el archivo.", "error", 3500);
        } finally {
            setDownloading(false);
        }
    };

    const descargar = async (doc: DocumentoRow) => {
        try {
            setTimeout(() => setDownloading(true), 0);
            const { blob, filename } = await (apiManager as any).personal.descargarDocumento({ id_documento: doc.id });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (e: any) {
            notify(e?.message || 'No se pudo descargar el documento.', 'error', 3500);
        } finally {
            setDownloading(false);
        }
    };
    const eliminarDeHistorial = async (doc: DocumentoRow) => {
        //console.log("info", doc);
        //return
        //alertiyf para confirmar
        if (!confirm('¿Desea eliminar el documento de la historia?')) {
            return;
        }
        try {
            setDownloading(true);
            const response = await (apiManager as any).personal.eliminarDeHistorial({ id: doc.id });
            if (response?.code === 200) {
                notify('Documeno eliminado de la historia correctamente.', 'success', 2500);
                fetchDocs(activePersona?.id || 0);
                setModalHistorialArchivos(false);
            } else {
                notify(response?.message || 'No se pudo eliminar el documento.', 'error', 3500);
            }
        } catch (e: any) {
            notify(e?.message || 'No se pudo eliminar el documento.', 'error', 3500);
        } finally {
            setDownloading(false);
        }
    };

    // ---- Aprobación/Desaprobación ----
    const openApprovePopup = (doc: DocumentoRow) => {
        setActiveDoc(doc);
        setComentario("");
        setShowApprovePopup(true);
    };

    const handleAprobar = async (estado: 0 | 1) => {
        if (!activeDoc) return;
        try {
            const body = {
                id: activeDoc.id,
                estado_aprobacion: estado,
                aprobador: "erodrigo",
                comentario_aprobacion: comentario,
            };
            const resp = await (apiManager as any).personal.aprobarDocumento(body);
            if (resp?.code === 200) {
                notify("Documento actualizado correctamente.", "success", 2500);
                setShowApprovePopup(false);
                if (activePersona) await fetchDocs(activePersona.id);
            } else {
                notify(resp?.message || "No se pudo actualizar el documento.", "error", 3500);
            }
        } catch (e: any) {
            notify(e?.message || "Error al actualizar documento.", "error", 3500);
        }
    };
    //nuevo aarchvo 02/02/2026
    const [nuevoArchivo, setNuevoArchivo] = useState<any>({
        id_documento: null,
        fechaRealizacion: moment().format('YYYY-MM-DD'),
        fechaVencimiento: moment().add(12, 'months').format('YYYY-MM-DD'),
        comentario: '',
        archivo: null, tipoExamenIds: []

    });
    const handleNuevoArchivo = async (e: any) => {
        const { name, id, type, value } = e.target;
        setNuevoArchivo({
            ...nuevoArchivo,
            [name]: type === 'file' ? e.target.files[0] : value
        })
    }
    const submitNuevoArchivo = async () => {
        if (!activePersona) return notify("No hay persona activa.", "warning", 2500);
        //notify("no endpoint yet.", "error", 2500);
        //return
        try {
            if (!nuevoArchivo.archivo) return notify("Selecciona un archivo.", "warning", 2500);
            //convierto las fechas a formato dd/mm/yyyy
            let fechaRealizacion = moment(nuevoArchivo.fechaRealizacion).format('DD/MM/YYYY');
            let fechaVencimiento = moment(nuevoArchivo.fechaVencimiento).format('DD/MM/YYYY');
            const formData = new FormData();
            formData.append("personal_id", String(activePersona.id));
            formData.append("documento_id", String(nuevoArchivo.id_documento));
            //formData.append("fecha_realizacion", nuevoArchivo.fechaRealizacion);
            //formData.append("fecha_vencimiento", nuevoArchivo.fechaVencimiento);
            formData.append("fecha_realizacion", fechaRealizacion);
            formData.append("fecha_vencimiento", fechaVencimiento);
            formData.append("comentario_documento", nuevoArchivo.comentario);
            formData.append("tipos_documento", nuevoArchivo.tipoExamenIds.join(","));
            formData.append("file", nuevoArchivo.archivo, nuevoArchivo.archivo.name);
            //formData.append("id", reemplazar ? String(doc.id) : "");
            //console.log("formData", formData);return
            const resp = await (apiManager as any).personal.insertarDocumentoModal(formData);
            if (resp?.code === 200) {
                notify("Documento subido correctamente.", "success", 2500);
                await fetchDocs(activePersona?.id || 0);
                setModalSubirArchivo(false);
            } else {
                notify(resp?.message || "No se pudo subir el archivo.", "error", 3500);
            }
        } catch (e: any) {
            notify(e?.message || "Error al subir el archivo.", "error", 3500);
        }
    }
    const [modalSubirArchivo, setModalSubirArchivo] = useState(false);
    const abrirModalSubirArchivo = (documento: any) => {
        //console.log("documento", documento);
        setNuevoArchivo({ ...nuevoArchivo, id_documento: documento.documento_id });
        setModalSubirArchivo(true);
    };
    const [enviandoCorreo, setEnviandoCorreo] = useState(false);
    const enviarCredencialesPorCorreo = async (credenciales: any) => {
        if (!activePersona || !credenciales) return notify("Hubo un error en el envio de credenciales.", "warning", 2500);
        try {
            setEnviandoCorreo(true);
            const resp = await (apiManager as any).personal.enviarCredencialesPorCorreo({
                usuario: credenciales.usuario,
                contrasena: credenciales.contrasena,
                email: credenciales.email
            });
            if (resp?.code === 200) {
                notify("Credenciales enviadas correctamente.", "success", 2500);
                //dialog.hide();
            } else {
                notify(resp?.message || "No se pudo enviar las credenciales.", "error", 3500);
            }
        } catch (e: any) {
            notify(e?.message || "Error al enviar las credenciales.", "error", 3500);
        } finally {
            setEnviandoCorreo(false);
        }


    }
    const generarCredenciales = async () => {
        //alert("generando credenciales para id personal=" + activePersona?.id);
        if (!activePersona) return notify("Por favor reintenta abriendo el flotante.", "warning", 2500);
        //antes vamos a consultar al servidor si es que ya tiene credenciales:
        const existeCredenciales = await (apiManager as any).personal.existeCredenciales({ persona_id: activePersona?.id });
        if (existeCredenciales?.data[0]?.credencial_activo == "1") {
            notify("Ya existen credenciales para este personal.", "warning", 2500);
            return;
        }
        const response = await (apiManager as any).personal.generarCredencial({ persona_id: activePersona?.id });
        if (response?.code === 200) {
            notify("Credenciales reseteadas correctamente.", "success", 2500);
            await fetchDocs(activePersona?.id || 0);
            const dialog = custom({
                title: "Resumen de Credenciales",
                messageHtml: `
                        <div class="space-y-6">
                            <p class="text-gray-700">
                                Se han creado las credenciales para 
                                <strong class="font-semibold text-gray-900">
                                ${activePersona?.nombres}
                                </strong>, tome nota:
                            </p>

                            <div class="space-y-4">
                                <div>
                                <label for="usernameInput" class="block text-sm font-medium text-gray-600">Usuario</label>
                                <input 
                                    type="text" 
                                    id="usernameInput" 
                                    class="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-800" 
                                    value="${response?.data?.usuario}" 
                                    readonly
                                >
                                </div>

                                <div>
                                <label for="passwordInput" class="block text-sm font-medium text-gray-600">Contraseña</label>
                                <input 
                                    type="text" 
                                    id="passwordInput" 
                                    class="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-800" 
                                    value="${response?.data?.contrasena}" 
                                    readonly
                                >
                                </div>

                                <div>
                                <label for="emailInput" class="block text-sm font-medium text-gray-600">Correo</label>
                                <input 
                                    type="email" 
                                    id="emailInput" 
                                    class="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-800" 
                                    value="${response?.data?.email}" 
                                    readonly
                                >
                                </div>
                            </div>

                            <!-- Botón centrado -->
                           <div class="flex justify-center pt-4">
                            <button 
                                id="sendBtn" 
                                class="px-6 py-2 bg-green-600 text-white font-medium rounded-md shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                Enviar Correo
                            </button>
                            </div>
                        </div>

  `,
                buttons: [
                    {
                        text: "Cerrar",
                        onClick: () => true, // este sí cierra el modal
                        stylingMode: "outlined",
                        type: "normal",
                    }
                ],
            });

            dialog.show();

            // enganchar el botón manualmente
            setTimeout(() => {
                const btn = document.getElementById("sendBtn") as HTMLButtonElement;
                if (btn) {
                    btn.addEventListener("click", async () => {
                        btn.disabled = true; btn.textContent = "Enviando...";
                        await enviarCredencialesPorCorreo(response?.data);
                        btn.disabled = false;
                        btn.textContent = "Enviar Correo";
                    });
                }
            }, 0);

        }
    }
    const resetearCredenciales = async () => {
        if (!activePersona) return notify("Por favor reintenta abriendo el flotante.", "warning", 2500);
        //console.log("este es el active persona", activePersona)
        //antes voy a consultar si  tiene el documento de credenciales:
        const existeCredenciales = await (apiManager as any).personal.existeCredenciales({ persona_id: activePersona?.id });
        if (!existeCredenciales || existeCredenciales?.data[0]?.credencial_activo == "0") {
            notify("No existen credenciales para este personal.", "warning", 2500);
            return;
        }
        const response = await (apiManager as any).personal.resetearCredenciales({ usuario_id: existeCredenciales?.data[0]?.usuario_id });
        if (response?.code === 200) {
            notify("Credenciales reseteadas correctamente.", "success", 2500);
            await fetchDocs(activePersona?.id || 0);
            const dialog = custom({
                title: "Resumen de Credenciales",
                messageHtml: `
                        <div class="space-y-6">
                            <p class="text-gray-700">
                                Se han creado las credenciales para 
                                <strong class="font-semibold text-gray-900">
                                ${activePersona?.nombres}
                                </strong>, tome nota:
                            </p>

                            <div class="space-y-4">
                                <div>
                                <label for="usernameInput" class="block text-sm font-medium text-gray-600">Usuario</label>
                                <input 
                                    type="text" 
                                    id="usernameInput" 
                                    class="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-800" 
                                    value="${response?.data?.usuario}" 
                                    readonly
                                >
                                </div>

                                <div>
                                <label for="passwordInput" class="block text-sm font-medium text-gray-600">Contraseña</label>
                                <input 
                                    type="text" 
                                    id="passwordInput" 
                                    class="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-800" 
                                    value="${response?.data?.contrasena}" 
                                    readonly
                                >
                                </div>

                                <div>
                                <label for="emailInput" class="block text-sm font-medium text-gray-600">Correo</label>
                                <input 
                                    type="email" 
                                    id="emailInput" 
                                    class="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-800" 
                                    value="${response?.data?.email}" 
                                    readonly
                                >
                                </div>
                            </div>

                            <!-- Botón centrado -->
                           <div class="flex justify-center pt-4">
                            <button 
                                id="sendBtn" 
                                class="px-6 py-2 bg-green-600 text-white font-medium rounded-md shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                Enviar Correo
                            </button>
                            </div>
                        </div>

  `,
                buttons: [
                    {
                        text: "Cerrar",
                        onClick: () => true, // este sí cierra el modal
                        stylingMode: "outlined",
                        type: "normal",
                    }
                ],
            });

            dialog.show();

            // enganchar el botón manualmente
            setTimeout(() => {
                const btn = document.getElementById("sendBtn") as HTMLButtonElement;
                if (btn) {
                    btn.addEventListener("click", async () => {
                        btn.disabled = true; btn.textContent = "Enviando...";
                        await enviarCredencialesPorCorreo(response?.data);
                        btn.disabled = false;
                        btn.textContent = "Enviar Correo";
                    });
                }
            }, 0);

        }
    }

    const navigate = useNavigate();
    const [modalCredenciales, setModalCredenciales] = useState(false);
    const imprimirCredenciales = async () => {
        if (!activePersona) return notify("Por favor reintenta abriendo el flotante.", "warning", 2500);
        setModalCredenciales(true);
    }
    const [historialArchivos, setHistorialArchivos] = useState<any>([]);
    const [modalHistorialArchivos, setModalHistorialArchivos] = useState(false);
    const [tituloModalHistorialArchivos, setTituloModalHistorialArchivos] = useState("");
    const verHistorialArchivos = (documento: any) => {
        setTimeout(async () => {
            console.log("documento", documento);
            setNuevoArchivo({ ...nuevoArchivo, id_documento: documento.documento_id });
            setTituloModalHistorialArchivos(documento?.nombre_documento || "");
            const response = await (apiManager as any).personal.historialDocumento({ id_persona: activePersona?.id || 0, id_documento: documento.documento_id });
            setHistorialArchivos(response.data);
            /*if (response.data.length > 0 && response.data[0].tipos_examen && typeof response.data[0].tipos_examen != "undefined") {
                console.log(response.data[0]);
                setNuevoArchivo((prev: any) => {
                    return {
                        ...prev,
                        tipoExamenIds: response.data[0].tipos_examen.split(",").map((item: any) => item.trim())
                    };
                });
            } else {
                console.log("no tiene tipos de examen");
                setNuevoArchivo((prev: any) => {
                    return {
                        ...prev,
                        tipoExamenIds: []
                    };
                })
            }*/
            setModalHistorialArchivos(true);
        }, 0);
    };
    return (
        <div className="space-y-6">
            {/* Tabla de personal */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex justify-end items-end mb-4">
                    <div className="flex space-x-3">
                        <Button
                            text="Recargar"
                            icon="refresh"
                            type="normal"
                            stylingMode="outlined"
                            className="text-sm"
                            onClick={refrescar}
                        />
                    </div>
                </div>

                <DataGrid
                    dataSource={rows}
                    showBorders={false}
                    rowAlternationEnabled
                    columnAutoWidth
                    wordWrapEnabled
                    className="w-full"
                >
                    <Column dataField="nombres" caption="Nombres" />
                    <Column dataField="area" caption="Área" width={220} />
                    <Column dataField="puesto" caption="Puesto" width={220} />
                    <Column dataField="dni" caption="DNI" width={140} />
                    <Column
                        caption=""
                        width={170}
                        alignment="right"
                        cellRender={(cell) => {
                            const persona = cell.data as PersonaRow;
                            return (
                                <Button
                                    text="Ver documentos"
                                    type="default"
                                    stylingMode="contained"
                                    onClick={() => openDocs(persona)}
                                />
                            );
                        }}
                    />
                    <SearchPanel visible width={260} placeholder="Buscar personal..." />
                    <Paging defaultPageSize={10} />
                    <Pager showNavigationButtons showPageSizeSelector allowedPageSizes={[10, 20, 50]} />
                </DataGrid>
            </div>

            {/* Modal para ver el historial de archivos */}
            <Popup
                visible={modalHistorialArchivos}
                onHiding={() => setModalHistorialArchivos(false)}
                showCloseButton
                dragEnabled
                resizeEnabled
                width="90vw"
                maxWidth={1100}
                height="auto"
                maxHeight="90vh"
                wrapperAttr={{ class: "docs-modal" }}
                titleRender={() => (
                    <div className="flex justify-between items-center w-full pr-6">
                        <div style={{ fontSize: "1.25rem", whiteSpace: "normal", overflow: "visible" }}>
                            Historial de Archivos {tituloModalHistorialArchivos}
                        </div>
                        <Button
                            icon="close"
                            stylingMode="text"
                            onClick={() => setModalHistorialArchivos(false)}
                        />
                    </div>
                )}
            >
                <div className="p-4">
                    <DataGrid
                        dataSource={historialArchivos}
                        showBorders={true}
                        rowAlternationEnabled={true}
                        columnAutoWidth={true}
                        noDataText="No hay archivos en el historial"
                    >
                        <Column
                            dataField="fecha_subida"
                            caption="Fecha subida"
                            dataType="date"
                            format="dd/MM/yyyy"
                        />
                        <Column
                            dataField="fecha_aprobacion"
                            caption="Fecha aprobación"
                            dataType="date"
                            format="dd/MM/yyyy"
                        />
                        <Column
                            dataField="fecha_realizacion"
                            caption="Fecha Realización"
                            dataType="date"
                            format="dd/MM/yyyy"
                        />
                        <Column
                            dataField="fecha_vencimiento"
                            caption="Fecha Vencimiento"
                            dataType="date"
                            format="dd/MM/yyyy"
                        />
                        <Column
                            dataField="comentario_aprobacion"
                            caption="Comentario Aprobador"
                        />
                        <Column
                            dataField="tipos_examen"
                            caption="Tipos de Exámenes"
                        />
                        <Column
                            caption="Archivo"
                            //width={280}
                            cellRender={(cell) => {
                                const r = cell.data as any;
                                const hayArchivo = !!r.url_documento;

                                return (
                                    <div className="flex justify-start gap-2 px-2 py-1">
                                        {hayArchivo && (
                                            <Button
                                                //text={"D" + r.id}
                                                text="Descargar"
                                                type="default"
                                                stylingMode="contained"
                                                className="min-w-[100px]"
                                                onClick={() => descargar(r)}
                                                disabled={downloading}
                                            />
                                        )}
                                    </div>
                                );
                            }}
                        />
                        <Column
                            caption="Eliminar"
                            cellRender={(cell) => {
                                const r = cell.data as any;
                                const hayArchivo = !!r.url_documento;

                                return (
                                    <div className="flex justify-start gap-2 px-2 py-1">
                                        {hayArchivo && (
                                            <Button
                                                onClick={() => eliminarDeHistorial(r)}
                                                disabled={downloading}
                                                stylingMode="text"
                                            >
                                                <span className="flex items-center justify-center w-6 h-6">
                                                    <i className="dx-icon-trash text-red-600 text-base" />
                                                </span>
                                            </Button>

                                        )}
                                    </div>
                                );
                            }}
                        />
                    </DataGrid>
                </div>
                {historialArchivos?.length > 0 && (
                    <div className="p-4 space-y-4">
                        {/*sub titulo h1 consigna para  el formlario*/}
                        <h1 className="text-xl font-semibold text-gray-800">Subir Nuevo Archivo</h1>
                        {/* Fecha de realización */}
                        <div>
                            <label className="block font-semibold mb-1">Fecha de realización</label>
                            <input type="date" className="border rounded px-3 py-2 w-full" value={nuevoArchivo?.fechaRealizacion} onChange={handleNuevoArchivo} name="fechaRealizacion"
                            />
                        </div>

                        {/* Fecha de vencimiento */}
                        <div>
                            <label className="block font-semibold mb-1">Fecha de vencimiento</label>
                            <input type="date" className="border rounded px-3 py-2 w-full" value={nuevoArchivo?.fechaVencimiento} onChange={handleNuevoArchivo} name="fechaVencimiento"
                            />
                        </div>

                        {/* Tipo de Examen Realizado */}
                        <div>
                            <label className="block font-semibold mb-1">Tipo de examen realizado</label>
                            <div className="flex space-x-4">
                                {listaTipoExamen.map((tipo: any) => (
                                    <label key={tipo.id} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            value={tipo.valor}
                                            checked={nuevoArchivo?.tipoExamenIds?.includes(tipo.valor) || false}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setNuevoArchivo((prev: any) => {
                                                    const current = prev.tipoExamenIds || [];
                                                    return {
                                                        ...prev,
                                                        tipoExamenIds: checked
                                                            ? [...current, tipo.valor]
                                                            : current.filter((valor: any) => valor != tipo.valor),
                                                    };
                                                });
                                            }}
                                        />
                                        <span>{tipo.descripcion}</span>
                                        {/* {JSON.stringify(tipo)} */}
                                    </label>
                                ))}
                            </div>
                        </div>



                        {/* Comentario */}
                        <div>
                            <label className="block font-semibold mb-1">Comentario</label>
                            <textarea className="border rounded px-3 py-2 w-full" rows={3} value={nuevoArchivo?.comentario} onChange={handleNuevoArchivo} name="comentario"
                            />
                        </div>

                        {/* Seleccionar documento */}
                        <div>
                            <label className="block font-semibold mb-1">Seleccionar documento</label>
                            <input type="file" className="border rounded px-3 py-2 w-full" onChange={handleNuevoArchivo} name="archivo" />
                        </div>

                        {/* Botones */}
                        <div className="flex justify-end space-x-4 pt-4">
                            <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" onClick={submitNuevoArchivo} >
                                Cargar
                            </button>
                            <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700" onClick={() => setModalHistorialArchivos(false)}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

            </Popup>

            {/* Modal para subir archivos */}
            <Popup visible={modalSubirArchivo} onHiding={() => setModalSubirArchivo(false)}
                showCloseButton
                dragEnabled
                resizeEnabled
                width="90vw"
                maxWidth={1100}
                height="auto"
                maxHeight="90vh"
                wrapperAttr={{ class: "docs-modal" }}
                titleRender={() => (
                    <div className="flex justify-between items-center w-full pr-6">
                        <div style={{ fontSize: "1.25rem", whiteSpace: "normal", overflow: "visible" }}>
                            Subir Documento
                        </div>
                        <Button icon="close" stylingMode="text" onClick={() => setModalSubirArchivo(false)}
                        />
                    </div>
                )}
            >
                <div className="p-4 space-y-4">
                    {/* Fecha de realización */}
                    <div>
                        <label className="block font-semibold mb-1">Fecha de realización</label>
                        <input type="date" className="border rounded px-3 py-2 w-full" value={nuevoArchivo?.fechaRealizacion} onChange={handleNuevoArchivo} name="fechaRealizacion"
                        />
                    </div>

                    {/* Fecha de vencimiento */}
                    <div>
                        <label className="block font-semibold mb-1">Fecha de vencimiento</label>
                        <input type="date" className="border rounded px-3 py-2 w-full" value={nuevoArchivo?.fechaVencimiento} onChange={handleNuevoArchivo} name="fechaVencimiento"
                        />
                    </div>
                    {/* Tipo de Examen Realizado */}
                    <div>
                        <label className="block font-semibold mb-1">Tipo de examen realizado</label>
                        <div className="flex space-x-4">
                            {listaTipoExamen.map((tipo: any) => (
                                <label key={tipo.id} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        value={tipo.valor}
                                        checked={nuevoArchivo?.tipoExamenIds?.includes(tipo.valor) || false}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setNuevoArchivo((prev: any) => {
                                                const current = prev.tipoExamenIds || [];
                                                return {
                                                    ...prev,
                                                    tipoExamenIds: checked
                                                        ? [...current, tipo.valor]
                                                        : current.filter((valor: any) => valor != tipo.valor),
                                                };
                                            });
                                        }}
                                    />
                                    <span>{tipo.descripcion}</span>
                                    {/* {JSON.stringify(tipo)} */}
                                </label>
                            ))}
                        </div>
                    </div>
                    {/* Comentario */}
                    <div>
                        <label className="block font-semibold mb-1">Comentario</label>
                        <textarea className="border rounded px-3 py-2 w-full" rows={3} value={nuevoArchivo?.comentario} onChange={handleNuevoArchivo} name="comentario"
                        />
                    </div>

                    {/* Seleccionar documento */}
                    <div>
                        <label className="block font-semibold mb-1">Seleccionar documento</label>
                        <input type="file" className="border rounded px-3 py-2 w-full" onChange={handleNuevoArchivo} name="archivo" />
                    </div>

                    {/* Botones */}
                    <div className="flex justify-end space-x-4 pt-4">
                        <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" onClick={submitNuevoArchivo} >
                            Cargar
                        </button>
                        <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700" onClick={() => setModalSubirArchivo(false)}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </Popup>
            {/* Modal de documentos */}
            <Popup
                visible={showDocs}
                onHiding={() => { setShowDocs(false); setActivePersona(null); setDocs([]); }}
                showCloseButton
                dragEnabled
                resizeEnabled
                width="90vw"
                maxWidth={1100}
                height="auto"
                maxHeight="90vh"
                wrapperAttr={{ class: "docs-modal" }}
                //title={activePersona ? `Documentos: ${activePersona.nombres}` : "Documentos"}
                titleRender={() => (
                    <div className="flex justify-between items-center w-full pr-6">
                        <div style={{ fontSize: "1.25rem", whiteSpace: "normal", overflow: "visible" }}>
                            {activePersona ? `Documentos: ${activePersona.nombres}` : "Documentos"}
                        </div>
                        <Button
                            icon="close"
                            stylingMode="text"
                            onClick={() => { setShowDocs(false); setActivePersona(null); setDocs([]); }}
                        />
                    </div>
                )}
            >

                <div className="p-2">
                    {loading ? (
                        <div className="p-6 text-sm text-gray-500">Cargando documentos...</div>
                    ) : docs.length === 0 ? (
                        <div className="p-6 text-sm text-gray-500">Sin documentos para mostrar.</div>
                    ) : (
                        <div className="rounded-2xl border bg-white p-3 shadow-sm">
                            <DataGrid
                                dataSource={docs}
                                keyExpr="id"
                                showBorders={false}
                                rowAlternationEnabled
                                columnAutoWidth
                                wordWrapEnabled={true}
                            >
                                <Column dataField="nombre_documento" caption="Documento" />
                                <Column
                                    caption="Fecha subida"
                                    dataField="fecha_subida"
                                    width={150}
                                    calculateDisplayValue={(row: DocumentoRow) => fechaDisp(row.fecha_subida)}
                                />
                                <Column
                                    caption="Estado"
                                    dataField="estado_aprobacion"
                                    width={120}
                                    cellRender={(cell) => estadoBadge(cell.data.estado_aprobacion)}
                                />
                                <Column
                                    caption="Archivo"
                                    width={280}
                                    cellRender={(cell) => {
                                        const r = cell.data as DocumentoRow;
                                        const hayArchivo = !!r.url_documento;
                                        const editable = r.estado_aprobacion !== "1";

                                        return (
                                            <div className="flex justify-start gap-2 px-2 py-1">
                                                {hayArchivo && (
                                                    <Button
                                                        //text={"D" + r.id}
                                                        text="Descargar"
                                                        type="default"
                                                        stylingMode="contained"
                                                        className="min-w-[100px]"
                                                        onClick={() => descargar(r)}
                                                        disabled={downloading}
                                                    />
                                                )}
                                                {editable && (<>
                                                    {r.abre_modal == "1" ? (
                                                        <>{hayArchivo ? "" :
                                                            <Button
                                                                text={hayArchivo ? "Reemplazar" : "Subir"}
                                                                type="secondary"
                                                                stylingMode="contained"
                                                                className="ml-3 justify-start min-w-[27px] h-10"
                                                                onClick={(e) => abrirModalSubirArchivo(r)}
                                                                disabled={downloading}
                                                            />
                                                        }
                                                        </>
                                                    ) :
                                                        <FileUploader
                                                            disabled={downloading}
                                                            multiple={false}
                                                            selectButtonText={hayArchivo ? "Reemplazar" : "Subir"}
                                                            labelText=""
                                                            accept="application/pdf,image/*"
                                                            className="ustify-start h-10" // fuerza altura consistente
                                                            onValueChanged={
                                                                (e: any) => {
                                                                    const file: File | undefined = e?.value?.[0];
                                                                    if (file) {
                                                                        subirDocumento(r, file, hayArchivo)
                                                                    };
                                                                }}
                                                        />
                                                    }
                                                </>)}
                                                {/* {r.abre_modal == "1" ? "abrir" : "NO"} */}
                                            </div>
                                        );
                                    }}
                                />


                                {/* NUEVA COLUMNA ACCIONES */}
                                <Column
                                    caption="Aprobar/Desaprobar"
                                    width={150}
                                    cellRender={(cell) => {
                                        const r = cell.data as DocumentoRow;
                                        return (
                                            <Button
                                                text="Gestionar"
                                                type="default"
                                                stylingMode="contained"
                                                onClick={() => openApprovePopup(r)}
                                                disabled={r.estado_aprobacion === "1"}
                                            />
                                        );
                                    }}
                                />
                                {/* NUEVA COLUMNA para HISOTRIAL */}
                                <Column
                                    caption="Historial"
                                    width={150}
                                    cellRender={(cell) => {
                                        const r = cell.data as DocumentoRow;
                                        return r.abre_modal == "1" ?
                                            <Button
                                                text="Ver Historial"
                                                type="default"
                                                stylingMode="contained"
                                                onClick={() => verHistorialArchivos(r)}
                                            //disabled={r.estado_aprobacion === "1"}
                                            />
                                            : "-"
                                    }}
                                />
                                <Paging defaultPageSize={10} />
                                <Pager showNavigationButtons showPageSizeSelector allowedPageSizes={[10, 20, 50]} />
                            </DataGrid>
                        </div>
                    )}
                    {/** aqui pondre al lado derecho un boton que diga generar credenciales , pero estara deshabilitado si los docs no estan todos aprobados*/}
                    <div className="flex items-center justify-end gap-2 mt-4">
                        {yaExisteCredenciales ?
                            <>
                                <Button
                                    text="Imprimir Credenciales"
                                    type="secondary"
                                    stylingMode="contained"
                                    onClick={imprimirCredenciales}

                                />
                                <Button
                                    text="Resetear credenciales"
                                    type="warning"
                                    stylingMode="contained"
                                    onClick={resetearCredenciales}

                                />
                            </>
                            :
                            <Button
                                text="Generar credenciales"
                                type="success"
                                stylingMode="contained"
                                onClick={generarCredenciales}
                                //disabled={docs.reduce((acc, doc) => acc && doc.requerido_credencial == "1" && doc.estado_aprobacion == "1", true) === false}
                                disabled={
                                    !docs.every(
                                        doc => doc.requerido_credencial !== "1" || doc.estado_aprobacion === "1"
                                    )
                                }
                            />
                        }
                    </div>
                </div>
            </Popup>

            {/* Modal de aprobación/desaprobación */}
            <Popup
                visible={showApprovePopup}
                onHiding={() => setShowApprovePopup(false)}
                showCloseButton
                dragEnabled
                resizeEnabled
                width={500}
                height="auto"
                title="Aprobar/Desaprobar Documento"
            >
                <div className="p-4 space-y-4">
                    <div className="text-sm font-medium">{activeDoc?.nombre_documento}</div>
                    <textarea
                        className="w-full border rounded p-2"
                        placeholder="Comentario"
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        rows={4}
                    />
                    <div className="flex justify-end gap-2">
                        <Button text="Desaprobar" type="normal" onClick={() => handleAprobar(0)} />
                        <Button text="Aprobar" type="success" onClick={() => handleAprobar(1)} />
                    </div>
                </div>
            </Popup>
            {/* Modal de aprobación/desaprobación */}
            <Popup
                visible={modalCredenciales}
                onHiding={() => setModalCredenciales(false)}
                showCloseButton
                dragEnabled
                resizeEnabled
                width={"70%"}
                height={"80%"}
                title="Vista Previa de Credencial"
            >
                <div className="p-4 space-y-4">
                    <CredencialesPage idPersonal={activePersona?.id} />
                </div>
            </Popup>
        </div>
    );
};
const ReportesDocumentos: React.FC<{ personal: Personal[]; empresaId: number }> = ({ personal, empresaId }) => {
    const [chartMode, setChartMode] = useState<"pie" | "bar">("pie");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [modalInfo, setModalInfo] = useState<{ estado: string; tipo: string; porcentaje: number; personas: any } | null>(null);
    type GrafData = {
        tipoId: number;
        tipoNombre: string;
        stats: { estado: "Aprobado" | "Desaprobado" | "Pendiente"; value: number }[];
        total: number;
    };
    const [graficos, setGraficos] = useState<GrafData[]>([]);
    useEffect(() => {
        let ignore = false;

        type AggregadoPorTipo = {
            documento_id: number;
            nombre_documento: string;
            aprobados: number;
            desaprobados: number;
            pendientes_aprobacion: number;
            no_subidos: number
        };

        const calcularDesdeAgregado = (agregados: AggregadoPorTipo[]) => {
            // Elegimos 4 tipos: prioriza la configuración, si faltan completa con los más voluminosos
            let cuatroTipos: any = []

            if (cuatroTipos.length < 4) {
                const ordenados = [...agregados].sort((a, b) => {
                    const tA = a.aprobados + a.desaprobados + a.pendientes_aprobacion + a.no_subidos;
                    const tB = b.aprobados + b.desaprobados + b.pendientes_aprobacion + b.no_subidos;
                    return tB - tA;
                });
                const faltantes = ordenados
                    .filter((row) => !cuatroTipos.some((t: any) => Number(t.id) === Number(row.documento_id)))
                    .slice(0, 4 - cuatroTipos.length)
                    .map((row) => ({ id: row.documento_id, valor: row.nombre_documento }));
                cuatroTipos = [...cuatroTipos, ...faltantes].slice(0, 4);
            }

            // Armamos datos % para los 4 tipos
            const charts = cuatroTipos.map((t: any) => {
                const row = agregados.find((r) => Number(r.documento_id) === Number(t.id));
                const tot =
                    (row?.aprobados || 0) + (row?.desaprobados || 0) + (row?.pendientes_aprobacion || 0) + (row?.no_subidos || 0) || 1;

                return {
                    tipoId: t.id,
                    tipoNombre: t.valor,
                    total: tot,
                    stats: [
                        { estado: "Aprobado" as const, value: Math.round(((row?.aprobados || 0) * 100) / tot) },
                        { estado: "Desaprobado" as const, value: Math.round(((row?.desaprobados || 0) * 100) / tot) },
                        { estado: "Pendiente" as const, value: Math.round(((row?.pendientes_aprobacion || 0) * 100) / tot) },
                        { estado: "No subido" as const, value: Math.round(((row?.no_subidos || 0) * 100) / tot) },
                    ],
                };
            });

            return charts;
        };

        const fetchAgregadoSimulado = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await apiManager.personal.reportes({ "empresa_id": empresaId });
                //console.log("el back", response.data);
                let convertido_string_a_numero = response.data.map((item: any) => {
                    return {
                        ...item,
                        aprobados: Number(item.aprobados),
                        desaprobados: Number(item.desaprobados),
                        pendientes_aprobacion: Number(item.pendientes_aprobacion),
                        no_subidos: Number(item.no_subidos)
                    }
                })
                //console.log("convertido", convertido_string_a_numero);
                const charts = calcularDesdeAgregado(convertido_string_a_numero);

                if (!ignore) setGraficos(charts);
            } catch (e: any) {
                if (!ignore) setError(e?.message || "No se pudieron generar los reportes.");
            } finally {
                if (!ignore) setLoading(false);
            }
        };

        fetchAgregadoSimulado();
        return () => {
            ignore = true;
        };
        // Dependencias mínimas: si cambian tipos o empresa, recalculamos
    }, [empresaId]);

    const renderizarModal = async (e: any, registro: any) => {
        // Capturamos el estado clicado
        const estado = e.target.data.estado;
        const porcentaje = e.target.data.value;
        let estadoDoc = "";
        switch (estado) {
            case "Aprobado":
                estadoDoc = "1";
                break;
            case "Desaprobado":
                estadoDoc = "0";
                break;
            case "Pendiente":
                estadoDoc = "NULL";
                break;
            case "No subido":
                estadoDoc = "N";
                break;
        }
        const response = await apiManager.personal.listaPersonalDocumento({ "empresa_id": empresaId, documento_id: registro.tipoId, estado_doc: estadoDoc });
        if (response.data) {
            setModalInfo({
                estado: estado,
                tipo: registro.tipoNombre,
                porcentaje: porcentaje,
                personas: response.data
            });
        }
        //console.log("e", e.target.data, estado, porcentaje);
    }
    return (
        <div className="mt-8 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Reporte de documentos por estado</h2>
                {/* <p className="text-xs text-gray-500">Empresa seleccionada: {empresaId || "—"}</p> */}
            </div>
            <div className="flex items-center gap-3 mb-4">
                <span className={`text-sm ${chartMode === "pie" ? "text-gray-900" : "text-gray-500"}`}>Tortas</span>
                {/* Toggle */}
                <button
                    type="button"
                    onClick={() => setChartMode((m) => (m === "pie" ? "bar" : "pie"))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition
        ${chartMode === "bar" ? "bg-blue-600" : "bg-gray-300"}`}
                    aria-label="Cambiar tipo de gráfico"
                    title="Cambiar tipo de gráfico"
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition
          ${chartMode === "bar" ? "translate-x-6" : "translate-x-1"}`}
                    />
                </button>
                <span className={`text-sm ${chartMode === "bar" ? "text-gray-900" : "text-gray-500"}`}>Barras</span>
            </div>
            {loading && <div className="p-4 text-sm text-gray-500">Calculando…</div>}
            {error && <div className="p-4 text-sm text-red-600">{error}</div>}
            {!loading && !error && graficos.length === 0 && (
                <div className="p-4 text-sm text-gray-500">Sin datos para graficar.</div>
            )}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {graficos.map((g) => {
                    const barData = [
                        {
                            categoria: g.tipoNombre,
                            Aprobado: g.stats.find(s => s.estado === "Aprobado")?.value ?? 0,
                            Desaprobado: g.stats.find(s => s.estado === "Desaprobado")?.value ?? 0,
                            Pendiente: g.stats.find(s => s.estado === "Pendiente")?.value ?? 0,
                        },
                    ];
                    //console.log("barData", barData)
                    return <div
                        key={g.tipoId}
                        className="rounded-xl border p-4 overflow-hidden min-h-[360px] flex flex-col"
                    >
                        <div className="mb-2 flex items-center justify-between">
                            {/* <span className="text-sm font-medium text-gray-700 truncate">{g.tipoNombre}</span> */}
                            <span className="text-xs text-gray-400">{g.total} registro(s)</span>
                        </div>

                        <div className="mb-2 text-center">
                            {/* <h3 className="text-2xl font-semibold text-gray-800">Estados (%)</h3> */}
                            <h4 className="text-xl font-semibold text-gray-800">{g.tipoNombre}</h4>
                        </div>

                        {/* Chart centrado + leyenda abajo */}
                        <div className="flex-1 flex flex-col items-center justify-center">
                            {chartMode === "pie" ? (
                                <PieChart
                                    dataSource={g.stats}
                                    type="doughnut"
                                    innerRadius={0.55}
                                    size={{ height: 220 }}
                                    onPointClick={(e) => {
                                        renderizarModal(e, g)

                                    }}
                                    margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    sizeGroup="report-pies"
                                    resolveLabelOverlapping="hide"
                                    onInitialized={(e) => {
                                        setTimeout(() => e.component?.render?.(), 0);
                                    }}
                                    customizePoint={(arg: any) => {
                                        switch (String(arg.argument)) {
                                            case "Aprobado":
                                                return { color: "#7EA26C" };
                                            case "Desaprobado":
                                                return { color: "#eb792cff" };
                                            case "Pendiente":
                                                return { color: "#C9CF7A" };
                                            case "No subido":
                                                return { color: "#d41a11ff" };
                                            default:
                                                return {};
                                        }
                                    }}
                                >
                                    <Series argumentField="estado" valueField="value">
                                        <Label
                                            visible={true}
                                            position="inside"                 // pinta la etiqueta dentro de la rebanada (sin conectores)
                                            backgroundColor="transparent"     // sin fondo opaco
                                            // format={{ type: "percent", precision: 0 }}  // <-- NO usar si 'value' ya es 0..100
                                            customizeText={(arg: any) => {
                                                const v = Math.round(arg.value); // 'value' ya viene en porcentaje (0..100)
                                                return v >= 5 ? `${v}%` : "";    // oculta labels <5% para no saturar
                                            }}
                                        />
                                    </Series>
                                    <Legend visible={false} />
                                    <Tooltip
                                        enabled={true}
                                        customizeTooltip={(arg: any) => ({
                                            text: `${arg.argumentText}: ${Math.round(arg.value)}%`,
                                        })}
                                    />
                                </PieChart>
                            ) : (
                                /* ====== BARRAS AGRUPADAS (3 barras) ====== */
                                (() => {
                                    // % -> count
                                    const pct = (estado: "Aprobado" | "Desaprobado" | "Pendiente" | "No subido") =>
                                        g.stats.find(s => s.estado === estado)?.value ?? 0;

                                    const count = (p: number) => Math.round((g.total || 0) * p / 100);

                                    const barData = [{
                                        categoria: g.tipoNombre,
                                        Aprobado: count(pct("Aprobado")),
                                        Desaprobado: count(pct("Desaprobado")),
                                        Pendiente: count(pct("Pendiente")),
                                        'No subido': count(pct("No subido")),
                                    }];

                                    return (
                                        <Chart
                                            dataSource={barData}
                                            size={{ height: 220 }}
                                            margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            onInitialized={(e) => setTimeout(() => e.component?.render?.(), 0)}
                                        >
                                            {/* UNA sola CommonSeriesSettings (tipo barra, agrupadas por 'categoria') */}
                                            <CommonSeriesSettings
                                                argumentField="categoria"
                                                type="bar"
                                            />
                                            <CSeries valueField="Aprobado" name="Aprobado" color="#7EA26C"
                                                label={{ visible: true, position: "outside", customizeText: (arg: any) => `${arg.value}` }} />
                                            <CSeries valueField="Desaprobado" name="Desaprobado" color="#eb792cff"
                                                label={{ visible: true, position: "outside", customizeText: (arg: any) => `${arg.value}` }} />
                                            <CSeries valueField="Pendiente" name="Pendiente" color="#C9CF7A"
                                                label={{ visible: true, position: "outside", customizeText: (arg: any) => `${arg.value}` }} />
                                            <CSeries valueField="No subido" name="No subido" color="#d41a11ff"
                                                label={{ visible: true, position: "outside", customizeText: (arg: any) => `${arg.value}` }} />
                                            {/* Eje de valores en números absolutos (no %). Sin leyenda interna. */}
                                            <ValueAxis minValueMargin={0} />
                                            <CTooltip
                                                enabled={true}
                                                customizeTooltip={(arg: any) => ({ text: `${arg.seriesName}: ${arg.value}` })}
                                            />
                                            <CLegend visible={false} />
                                        </Chart>
                                    );
                                })()
                            )}

                        </div>

                    </div>
                })}
                {/* Modal con información adicional */}
                <Popup visible={!!modalInfo} onHiding={() => setModalInfo(null)}
                    showTitle={true}
                    title="Detalle del estado"
                    width={800}
                    height={800}
                    contentRender={() =>
                    (modalInfo ?
                        (<div className="p-2 space-y-2 text-sm text-gray-700">
                            <p><strong>Documento:</strong> {modalInfo.tipo}</p>
                            <p><strong>Estado:</strong> {modalInfo.estado}</p>
                            <p><strong>Porcentaje:</strong> {modalInfo.porcentaje}%</p>
                            <p><strong>Total Personas: {modalInfo.personas.length}</strong></p>
                            {/* Tabla compacta en dos columnas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {modalInfo.personas.length > 0 ?
                                    (modalInfo.personas.map((persona: any, idx: number) =>
                                    (<div key={idx} className="border px-2 py-1 text-xs truncate" >
                                        {idx + 1}. {persona.nombre_completo} </div>))) :
                                    (<div className="col-span-2 text-center text-gray-500 py-2"> No hay personas en este estado </div>)}
                            </div> </div>) : null)}
                >

                </Popup>
            </div>
            {/* Leyenda debajo del gráfico */}
            <div className="mt-4 flex justify-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#7EA26C" }}></span>
                    Aprobado
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#eb792cff" }}></span>
                    Desaprobado
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#C9CF7A" }}></span>
                    Pendiente
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#d41a11ff" }}></span>
                    No subido
                </div>
            </div>
        </div>

    );
}

const PersonalCRUD: React.FC = () => {
    // Por defecto se carga primero la lista de activos (estado 1)
    const { personal, estado, addPersonal, updatePersonal, deletePersonal, reactivarPersonal, getPersonalById, fetchAll } = usePersonal(1);
    const [showForm, setShowForm] = useState(false);
    const [editingPersonal, setEditingPersonal] = useState<Personal | null>(null);
    const [activeView, setActiveView] = useState<"empty" | "personal" | "documentos" | "reporte">("empty");
    const menuItems: NavItem[] = [
        { text: "Personal", onClick: () => setActiveView("personal") },
        { text: "Documentos", onClick: () => setActiveView("documentos") },
        { text: "Reporte", onClick: () => setActiveView("reporte") },
        /*{
            text: "Reportes",
            items: [
                { text: "Estado de Documentos", onClick: () => setActiveView("documentos") },
                { text: "Resumen de Personal", onClick: () => setActiveView("personal") },
            ],
        },*/
    ];
    const handleAdd = () => {
        setEditingPersonal(null);
        setShowForm(true);
    };

    const handleEdit = (personal: Personal) => {
        setEditingPersonal(personal);
        setShowForm(true);
    };
    const [maestros, setMaestros] = useState<any>({
        areas: [],
        subAreas: [],
        puestos: [],
        empresas: [],
        tipoPersonal: [],
        guardias: [],
        estadosCiviles: [],
        sistemaTrabajo: [],
        regimenes: [],
        tipoDocumentos: [],
        motivoCese: [],
        tipoExamen: [],
    });
    useEffect(() => {
        fetchMaestros().then(setMaestros);
    }, []);
    const handleDelete = (id: number) => {
        const personalToDelete = getPersonalById(id);
        if (!personalToDelete) return;
        let tipoCese = "";
        let comentarioCese = "";
        //console.log("motivos cese", maestros?.motivoCese);
        const opcionesHtml = maestros?.motivoCese
            .map((motivo: any) => `<option value="${motivo.id}">${motivo.valor}</option>`)
            .join("");
        const dialog = custom({
            title: "Confirmar Cese de Personal",
            messageHtml: `
        <div class="space-y-4">
            <p>¿Está seguro de cesar a <strong>${personalToDelete.nombres} ${personalToDelete.ape_pat}</strong>?</p>
            <p>La acción no se puede deshacer.</p>
            <label class="block text-sm font-medium">Tipo de Cese:</label>
            <select id="tipoCeseSelect" class="w-full border rounded px-2 py-1">
                <option value="">Seleccione un motivo de cese</option>
                ${opcionesHtml}
            </select>

            <label class="block text-sm font-medium mt-2">Comentario:</label>
            <textarea id="comentarioCeseInput" rows="3" class="w-full border rounded px-2 py-1" placeholder="Escriba un comentario..."></textarea>
        </div>
    `,
            buttons: [
                {
                    text: "Cesar",
                    onClick: () => {
                        const selectEl = document.getElementById("tipoCeseSelect") as HTMLSelectElement;
                        const commentEl = document.getElementById("comentarioCeseInput") as HTMLTextAreaElement;
                        tipoCese = selectEl?.value || "";
                        comentarioCese = commentEl?.value.trim() || "";
                        if (!tipoCese) {
                            alert("Debe seleccionar un tipo de cese.");
                            return false;
                        }
                        deletePersonal(id, { personal_id: id, motivo_cese_id: tipoCese, comentario_Cese: comentarioCese });
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
    const handleReactivar = (id: number) => {
        const p = getPersonalById(id);
        if (!p) return;
        const dialog = custom({
            title: "Confirmar Reactivación",
            messageHtml: `<p>¿Desea reactivar a <strong>${p.nombres} ${p.ape_pat}</strong>?</p>
                <p class="text-sm">Solo se cambia su estado a activo; no se reactivan sus cuentas de acceso ni cambia su fecha de ingreso.</p>`,
            buttons: [
                {
                    text: "Reactivar",
                    onClick: async () => {
                        try {
                            const resp = await reactivarPersonal(id);
                            if (resp?.code === 200) {
                                showMessage('Personal reactivado correctamente', 'success');
                            } else {
                                showMessage('No se pudo reactivar: ' + (resp?.message || ''), 'error');
                            }
                        } catch (e: any) {
                            showMessage('No se pudo reactivar: ' + (e?.response?.data?.message || e?.message || ''), 'error');
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
    const handleSubmit = async (data: PersonalFormData) => {
        if (editingPersonal?.id !== undefined && !isNaN(Number(editingPersonal.id))) {
            updatePersonal(Number(editingPersonal.id), data);
        } else {
            const response = await addPersonal(data);
            if (response.code === 200) {
                showMessage('Personal creado correctamente', 'success');
            } else {
                showMessage('Error al crear personal: ' + response.message, 'error');
            }
        }
        setShowForm(false);
        setEditingPersonal(null);
    };
    const handleCancel = () => {
        setShowForm(false);
        setEditingPersonal(null);
    };

    const usuarioCookie = localStorage.getItem("usuarioCookie");
    const usuarioParsed = usuarioCookie ? JSON.parse(usuarioCookie) : { empresa_id: 0 };
    const idEmpresaUsuario = usuarioParsed.empresa_id;
    const [selectedEmpresa, setSelectedEmpresa] = useState<number>(idEmpresaUsuario);  // Estado para la empresa seleccionada
    const handleEmpresaChange = (e: any) => {
        const id = e.value;
        setSelectedEmpresa(id);
        fetchAll(id);  // Recarga los datos al cambiar la empresa
    };
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">


                {/* Encabezado y botón */}
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <NavDropdown id="nav-personal" items={menuItems} />
                        {activeView !== "empty" && (
                            <h1 className="text-lg sm:text-xl font-semibold text-gray-800">
                                {activeView === "personal"
                                    ? "Lista Personal"
                                    : activeView === "documentos"
                                        ? "Documentos"
                                        : ""}
                            </h1>
                        )}
                    </div>

                    {activeView === "personal" && (
                        <Button
                            type="default"
                            stylingMode="contained"
                            text="Agregar Personal"
                            onClick={handleAdd}
                        />
                    )}
                </div>
                {/* Filtro de empresa */}
                <div className="mb-4 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        Cambiar empresa:
                    </span>
                    <SelectBox
                        id="empresa-select"
                        dataSource={maestros?.empresas}
                        value={selectedEmpresa}
                        displayExpr="razonSocial"
                        valueExpr="id"
                        onValueChanged={handleEmpresaChange}
                        placeholder="Seleccionar empresa"
                        className="w-full sm:w-64"
                        disabled={idEmpresaUsuario != 1}
                    />
                </div>

                {/* Vistas */}
                {activeView === "empty" && <EmptyState />}
                {activeView === "personal" && (
                    <PersonalList
                        personal={personal}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onReactivar={handleReactivar}
                        estado={estado === 0 ? 0 : 1}
                        onAdd={handleAdd}
                        onRefresh={(nuevoEstado) => fetchAll(selectedEmpresa, nuevoEstado)}
                    />
                )}
                {activeView === "documentos" && <DocumentosPanel personal={personal} listaTipoExamen={maestros?.tipoExamen} refrescar={() => fetchAll(selectedEmpresa)} />}
                {activeView === "reporte" &&
                    <ReportesDocumentos
                        personal={personal}
                        empresaId={selectedEmpresa}
                    />}

                {/* Popup */}
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
                    wrapperAttr={{ class: "personal-form-popup" }}
                >
                    <div className="max-h-[80vh] overflow-y-auto p-4">
                        <PersonalForm
                            personal={editingPersonal || undefined}
                            onSubmit={handleSubmit}
                            onCancel={handleCancel}
                            isEditing={!!editingPersonal}
                            listaAreas={maestros?.areas}
                            listaSubAreas={maestros?.subAreas}
                            listaPuestos={maestros?.puestos}
                            listaEmpresas={maestros?.empresas}
                            listaTipoPersonal={maestros?.tipoPersonal}
                            listaGuardias={maestros?.guardia}
                            listaEstadosCiviles={maestros?.estadoCivil}
                            listaSistemaTrabajo={maestros?.sistemaTrabajo}
                            listaRegimenes={maestros?.regimenPensionario}
                            listaTipoContrato={maestros?.tipoContrato}
                            listaTipoDocumentos={maestros?.tipoDocumentos}
                            id_empresa_usuario={idEmpresaUsuario}
                        />
                    </div>
                </Popup>
            </div>

        </div>
    );

};

export default PersonalCRUD;
