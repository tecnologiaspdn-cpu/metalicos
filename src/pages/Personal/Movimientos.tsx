// src/pages/Personal/Movimientos.tsx
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Popup } from "devextreme-react/popup";
import Button from "devextreme-react/button";
import MovimientosList from "../../components/Personal/MovimientosList";
import MovimientoForm from "../../components/Personal/MovimientoForm";
import { usePersonal } from "../../hooks/usePersonal";
import { useMovimientos } from "../../hooks/useMovimientos";
import { Personal } from "../../types/Personal";
import NavDropdown from "../../components/NavDropdown";
import { MovimientoListadoUI, NuevoDetalle } from "../../types/Movimientos";
import { useMaestros } from "../../hooks/useMaestros";

const EMPRESA_ID = 1;       // o toma el id real que corresponda

const MovimientosPage: React.FC = () => {
    const { personal } = usePersonal();
    const { empresas, tiposEntradas, tiposSalidas } = useMaestros();
    const { obtenerMovimientos, crearMovimiento, obtenerDetallesMovimiento, actualizarAprobacionDetalle, eliminarDetalle,
        actualizarEstadoMovimiento, loading, agregarDetalle } = useMovimientos();

    const [rows, setRows] = useState<MovimientoListadoUI[]>([]);
    const [activeView, setActiveView] = useState<"empty" | "list">("empty");

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<number>(0);

    const menuItems = [{ text: "Ver Movimientos", onClick: () => setActiveView("list") }];

    const personalOptions = useMemo(
        () =>
            (personal || []).map((p: Personal) => ({
                id: Number(p.id),
                text: `${p.nombres} ${p.ape_pat ?? ""} ${p.ape_mat ?? ""}`.trim(),
            })),
        [personal]
    );
    const empresasOptions = useMemo(() => empresas?.map((e) => ({ id: e.id, text: e.razonSocial })) || [], [empresas]);
    const tiposEntradaOptions = useMemo(() => tiposEntradas, [tiposEntradas]);
    const tiposSalidaOptions = useMemo(() => tiposSalidas, [tiposSalidas]);
    // ✅ useLayoutEffect para preservar scroll ANTES de que el navegador repinte
    useLayoutEffect(() => {
        if (scrollRef.current && scrollPositionRef.current > 0) {
            scrollRef.current.scrollTop = scrollPositionRef.current;
        }
    });

    // ✅ Guardar posición del scroll antes de cualquier cambio
    useEffect(() => {
        const scrollElement = scrollRef.current;
        if (!scrollElement) return;

        const handleScroll = () => {
            scrollPositionRef.current = scrollElement.scrollTop;
        };

        scrollElement.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollElement.removeEventListener('scroll', handleScroll);
    }, [showForm]);
    // Carga automática al abrir la vista "list"
    useEffect(() => {
        if (activeView !== "list") return;
        (async () => {
            //const data = await obtenerMovimientos(EMPRESA_ID);
            const usuarioCookie= localStorage.getItem('usuarioCookie')
            const idEmpresaUsuario = usuarioCookie ? JSON.parse(usuarioCookie).empresa_id : 0
            const data = await obtenerMovimientos(idEmpresaUsuario);
            setRows(data);
        })();
    }, [activeView, obtenerMovimientos]);

    const openNew = () => { setEditing(null); setShowForm(true); };
    const openEdit = async (m: MovimientoListadoUI) => {
        let detalles = await obtenerDetallesMovimiento(m.id);
        detalles.forEach((d) => (d.estado_cabeza = m.estado));
        //console.log("detalles", detalles);
        // “editing” será lo que el form usará como `initial`
        setEditing({
            // campos que el form ya usa
            id: m.id,
            tipo: m.tipo_movimiento?.toLowerCase().includes("salida") ? "Salida" : "Entrada",
            fecha: m.fecha,
            descripcion: m.descripcion,
            estado: m.estado,
            // opcional: empresa o tipo catálogo si los tienes mapeados
            // empresaId: ...
            // tipoMovPersonalId: ...
            // y el detalle:
            detalles,
        });
        setShowForm(true);
    };
    const toggleEstado = async (id: number, estado: string) => {
        console.log("toggleEstado", id);
        const response = await actualizarEstadoMovimiento(id, estado);
        setRows((prev) =>
            prev.map((m) =>
                m.id === id ? { ...m, estado: m.estado === "ABIERTO" ? "CERRADO" : "ABIERTO" } : m
            )
        );
    };

    const handleSubmit = useCallback(async (data: any) => {
        const response = await crearMovimiento(data);
        const updated = await obtenerMovimientos(EMPRESA_ID);
        setRows(updated);
        setShowForm(false);
        setEditing(null);
    }, [crearMovimiento, obtenerMovimientos]);

    const handleCancel = useCallback(() => {
        setShowForm(false);
        setEditing(null);
    }, []);
    const handleAgregarDetalle = useCallback((data: NuevoDetalle) => {
        const response = agregarDetalle(data);
        openEdit(data.movimiento);
    }, [agregarDetalle]);
    const aprobarDetalle = useCallback((id: number, aprobado: boolean | string) => {
        actualizarAprobacionDetalle(id, aprobado);
    }, [actualizarAprobacionDetalle]);

    const handleDetalle = useCallback(async (id: number) => {
        await eliminarDetalle(id);
    }, [eliminarDetalle]);
    const memoizedForm = useMemo(() => (
        <MovimientoForm
            initial={editing}
            personalOptions={personalOptions}
            empresasOptions={empresasOptions}
            tiposEntradaOptions={tiposEntradaOptions}
            tiposSalidaOptions={tiposSalidaOptions}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            agregarDetalle={handleAgregarDetalle}
            aprobarDetalle={aprobarDetalle}
            eliminarDetalle={handleDetalle}
        />
    ), [
        editing,
        personalOptions,
        empresasOptions,
        tiposEntradaOptions,
        tiposSalidaOptions,
        handleSubmit,
        handleCancel,
        handleAgregarDetalle,
        aprobarDetalle,
        handleDetalle
    ]);
    const formContainerRef = useRef<HTMLDivElement>(null);
    const lastScroll = useRef(0);
    useEffect(() => {
        const el = formContainerRef.current;
        if (!el) return;
        const onScroll = () => (lastScroll.current = el.scrollTop);
        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    useLayoutEffect(() => {
        const el = formContainerRef.current;
        if (el) el.scrollTop = lastScroll.current;
    });
    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border bg-white shadow-sm">
                            <NavDropdown id="nav-movimientos" items={menuItems} />
                        </div>
                        {activeView !== "empty" && (
                            <h1 className="text-lg sm:text-xl font-semibold text-gray-800">Ver Movimientos</h1>
                        )}
                    </div>

                    {activeView === "list" && (
                        <Button
                            text={loading ? "Cargando..." : "Nuevo Registro de Movimiento"}
                            type="default"
                            stylingMode="contained"
                            onClick={openNew}
                            disabled={loading}
                        />
                    )}
                </div>

                {/* Content */}
                {activeView === "empty" && (
                    <div className="flex items-center justify-center py-20 text-gray-500">
                        Usa “Ver Movimientos” en el menú para empezar.
                    </div>
                )}

                {activeView === "list" && (
                    <MovimientosList
                        data={rows}
                        onEdit={openEdit}
                        onToggleEstado={toggleEstado}
                    />
                )}

                {/* Popup Form */}
                <Popup
                    visible={showForm}
                    onHiding={() => setShowForm(false)}
                    showCloseButton
                    dragEnabled
                    resizeEnabled
                    width="95vw"
                    maxWidth={1100}
                    //height="auto"
                    height="80vh"
                    maxHeight="90vh"
                    wrapperAttr={{ class: "movimientos-form-popup" }}
                    focusStateEnabled={false}  // ✅ no reenfocar
                    //autoFocus={false}          // ✅ evita que vuelva al inicio
                    restorePosition={true}     // ✅ mantiene posición y tamaño
                >

                    <div ref={formContainerRef} className="h-[70vh] pr-2">
                        {memoizedForm}
                    </div>
                </Popup>
            </div>
        </div>
    );
};

export default MovimientosPage;
