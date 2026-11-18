// src/components/Personal/MovimientoForm.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Form, { GroupItem, SimpleItem } from "devextreme-react/form";
import DateBox from "devextreme-react/date-box";
import RadioGroup from "devextreme-react/radio-group";
import TextArea from "devextreme-react/text-area";
import SelectBox from "devextreme-react/select-box";
import DataGrid, { Column } from "devextreme-react/data-grid";
import Switch from "devextreme-react/switch";
import Button from "devextreme-react/button";
import { alert } from "devextreme/ui/dialog";

import type {
    Movimiento,
    MovimientoDetalle,
    MovimientoFormData,
    NuevoDetalle,
    TipoMovimiento,
} from "../../types/Movimientos";
import moment from "moment";

type PersonalOption = { id: number; text: string };
type CatalogOption = { id: number; text: string };

type Props = {
    initial: Movimiento | null;
    personalOptions: any[];
    /** NEW: catálogos del backend */
    //tiposMovOptions: CatalogOption[];
    tiposMovOptions?: any[];
    tiposEntradaOptions: any[];
    tiposSalidaOptions: any[];
    empresasOptions: any[];
    onSubmit: (data: MovimientoFormData) => void;
    onCancel: () => void;
    agregarDetalle: (dataNuevoDetalle: NuevoDetalle) => void;
    aprobarDetalle: (id_detalle: number, val: boolean | string) => void;
    eliminarDetalle: (id_detalle: number) => void;
};

const MovimientoForm: React.FC<Props> = ({
    initial,
    personalOptions,
    tiposMovOptions,
    tiposEntradaOptions,
    tiposSalidaOptions,
    empresasOptions,
    onSubmit,
    onCancel,
    agregarDetalle,
    aprobarDetalle,
    eliminarDetalle
}) => {
    const isEditing = !!initial;

    // Campos principales
    const [tipo, setTipo] = useState<TipoMovimiento>(initial?.tipo ?? "Entrada");
    const [fecha, setFecha] = useState<string>(initial?.fecha ?? new Date().toISOString());
    //const [tipoMovPersonalId, setTipoMovPersonalId] = useState<number>(initial?.tipoMovPersonalId ?? tiposMovOptions?.[0]?.id);
    //const [empresaId, setEmpresaId] = useState<number>(initial?.empresaId ?? empresasOptions?.[0]?.id);
    const [descripcion, setDescripcion] = useState<string>(initial?.descripcion ?? "");

    // Detalle (personal)
    const [detalles, setDetalles] = useState<MovimientoDetalle[]>(initial?.detalles ?? []);
    //console.log("recibo a render", detalles)
    const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

    const ds = useMemo(() => personalOptions, [personalOptions]);

    const [creatingNew, setCreatingNew] = useState(false);
    const creatingRef = useRef(false);
    const addDetalle = async () => {
        if (creatingRef.current) return;
        creatingRef.current = true;

        try {
            if (!selectedPersonId) return;

            const opt = ds.find((o) => o.id === selectedPersonId);
            if (!opt) return;

            if (detalles.some((d) => d.id_persona === opt.id)) {
                alert("<strong>El personal ya está en esta lista</strong>", "Notificación");
                return;
            }

            setCreatingNew(true);

            if (isEditing) {
                const dataNuevoDetalle: NuevoDetalle = {
                    id: initial.id,
                    id_persona: selectedPersonId,
                    aprobado: "0",
                    movimiento: initial,
                };

                // Envolvemos en una promesa para asegurar el bloqueo
                await new Promise<void>((resolve) => {
                    agregarDetalle(dataNuevoDetalle);
                    resolve();
                });

            } else {
                setDetalles((d) => [
                    ...d,
                    {
                        id_detalle: null,
                        id_persona: opt.id,
                        nombre: opt.text,
                        aprobado: "0",
                        estado_cabeza: "",
                    },
                ]);
            }

            setSelectedPersonId(null);
        } finally {
            setCreatingNew(false);
            creatingRef.current = false;
        }
    };



    const removeDetalle = (id: number, id_persona: number = 0) => {
        if (id == 0) return
        if (isEditing) {
            //console.log("llamare al api", id);
            eliminarDetalle(id);
        }
        setDetalles((d) => d.filter((x) => x.id_persona !== id_persona));
    };

    const setAprobado = (id_detalle: number | null, id: number, val: boolean | string) => {
        if (isEditing && id_detalle && !isNaN(id_detalle)) {
            //console.log("llamare al api", id_detalle, val);
            aprobarDetalle(id_detalle, val);
        } else {
            //console.log("error en editiing o gnorar si es nuevo", id_detalle, val, isEditing);
        }
        setDetalles((d) => d.map((x) => (x.id_persona === id ? { ...x, aprobado: val } : x)));
    };

    const aprobarTodos = () => {
        setDetalles((d) => d.map((x) => ({ ...x, aprobado: true })));
    };
    const submit = async () => {
        //if (creatingNew) return;
        /*if (isEditing) {
            //close modal
            onCancel();
        }*/
        setCreatingNew(true);
        onSubmit({
            tipo,
            fecha,
            tipoMovPersonalId: Number(tipoMovPersonalId),
            empresaId: Number(empresaId),
            descripcion: descripcion.trim(),
            detalles,
        });
        setCreatingNew(false);
    };
    const [tipoMovPersonalId, setTipoMovPersonalId] = useState<number>(
        initial?.tipoMovPersonalId ?? 1 // default Entrada
    );
    const usuarioCookie = localStorage.getItem('usuarioCookie')
    //console.log("usuarioCookie", usuarioCookie)
    const [empresaId, setEmpresaId] = useState<number>(
        //initial?.empresaId ?? 2 // default metalicos
        initial?.empresaId ?? (usuarioCookie ? JSON.parse(usuarioCookie).empresa_id : 1)
    );
    const [clasificacion, setClasificacion] = useState<string>(
        initial?.clasificacion ?? ""
    )
    useEffect(() => {
        if (initial?.detalles) {
            setDetalles(initial.detalles);
        } else {
            setDetalles([]); // por si entras sin detalles
        }
    }, [initial]);
    return (
        <div className="space-y-6">
            {/* Form principal con DevExpress Form */}
            <Form labelLocation="top" colCount={2} formData={{}}>
                {!isEditing &&
                    <GroupItem colSpan={2} caption="Datos del movimiento">
                        <SimpleItem colSpan={1} label={{ text: "Tipo de movimiento" }} render={() => (
                            <RadioGroup
                                items={["Entrada", "Salida"]}
                                value={tipo}
                                onValueChanged={(e: any) => {
                                    const val = e.value as TipoMovimiento;
                                    setTipo(val);
                                    //setTipoMovPersonalId(val === "Entrada" ? 1 : 2); // 👈 actualiza id backend
                                }}
                                layout="horizontal"
                            />
                        )} />
                        <SimpleItem colSpan={1} label={{ text: "Fecha" }} render={() => (
                            <DateBox
                                type="date"
                                value={fecha}
                                onValueChanged={(e: any) => setFecha(moment(e.value).format("MM-DD-YYYY"))}
                                displayFormat="yyyy-MM-dd"
                                className="w-full"
                            />
                        )} />

                        <SimpleItem colSpan={1} label={{ text: "Clasificacion de movimiento" }} render={() => (
                            // <SelectBox
                            //     dataSource={tiposMovOptions}
                            //     valueExpr="id"
                            //     displayExpr="text"
                            //     value={tipoMovPersonalId}
                            //     onValueChanged={(e: any) => setTipoMovPersonalId(Number(e.value))}
                            //     searchEnabled
                            //     className="w-full"
                            // />
                            <SelectBox
                                dataSource={tipo == "Entrada" ? tiposEntradaOptions : tiposSalidaOptions}
                                valueExpr={"id"}
                                displayExpr="nombre"
                                value={clasificacion}
                                onValueChanged={(e: any) => {
                                    let item = e.value
                                    //console.log("e", e.value);
                                    //console.log("item", item);
                                    setClasificacion(item);
                                    setTipoMovPersonalId
                                }}
                                placeholder="Selecciona una opción"
                                showClearButton={true}
                                //width={300}
                                className="w-full"
                            />

                        )} />
                        {/**/}
                        <SimpleItem
                            colSpan={1} label={{ text: ["Empresa"] }} render={() => (

                                < SelectBox
                                    disabled={true}
                                    dataSource={empresasOptions}
                                    valueExpr="id"
                                    displayExpr="text"
                                    value={empresaId}
                                    onValueChanged={(e: any) => setEmpresaId(Number(e.value))}
                                    searchEnabled
                                    className="w-full"
                                />
                            )} />


                        <SimpleItem colSpan={2} label={{ text: "Descripción" }} render={() => (
                            <TextArea
                                value={descripcion}
                                onValueChanged={(e: any) => setDescripcion(e.value)}
                                height={70}
                            />
                        )} />
                    </GroupItem>
                }

                <GroupItem colSpan={2} caption={"Detalle de personal"}>
                    {initial?.estado != "CERRADO" &&
                        <SimpleItem colSpan={2} render={() => (
                            <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
                                <SelectBox
                                    dataSource={ds}
                                    valueExpr="id"
                                    displayExpr="text"
                                    searchEnabled
                                    placeholder="Buscar por nombre..."
                                    value={selectedPersonId}
                                    onValueChanged={(e: any) => setSelectedPersonId(e.value as number)}
                                    className="w-full"
                                />
                                <Button text={creatingNew ? "Agregando..." : "Agregar"}
                                    type="default" onClick={addDetalle}
                                    stylingMode="contained" disabled={creatingNew} />
                            </div>
                        )} />
                    }
                    <SimpleItem colSpan={2} render={() => (
                        <div className="mt-4">
                            <DataGrid
                                key={creatingNew ? "loading" : "ready"}
                                dataSource={detalles}
                                keyExpr="id_persona"
                                showBorders={false}
                                rowAlternationEnabled
                                columnAutoWidth
                            >
                                <Column dataField="nombre" caption="Personal" />
                                <Column

                                    caption="Aprobado"
                                    dataField="aprobado"
                                    width={150}
                                    cellRender={(cell) => {
                                        const d = cell.data as MovimientoDetalle;
                                        if (empresaId == 1) {
                                            return (
                                                <div className="flex items-center gap-2">
                                                    {/* {d.aprobado} */}
                                                    {/* {d.estado_cabeza} */}
                                                    <Switch
                                                        disabled={d.estado_cabeza == "CERRADO"}
                                                        value={d.aprobado == "1"}//1=true,2=false
                                                        // permite aprobar también en creación
                                                        onValueChanged={(e: any) => {
                                                            //console.log("e", e, "d", d);
                                                            setAprobado(d.id_detalle, d.id_persona, d.aprobado == "1" ? "0" : "1")
                                                        }}
                                                    />
                                                    <span className="text-sm text-gray-700">
                                                        {d.aprobado == "1" ? "Aprobado" : "Desaprobado"}
                                                    </span>
                                                </div>
                                            );
                                        } else {
                                            return "-"
                                        }
                                    }}
                                />
                                {initial?.estado != "CERRADO" &&
                                    <Column
                                        caption=""
                                        width={110}
                                        alignment="right"
                                        cellRender={(cell) => {
                                            const d = cell.data as MovimientoDetalle;
                                            return (
                                                <Button
                                                    text="Quitar"
                                                    stylingMode="outlined"
                                                    //onClick={() => removeDetalle(d.id_persona)}
                                                    onClick={() => removeDetalle(d.id_detalle || 0, d.id_persona)}
                                                />
                                            );
                                        }}
                                    />
                                }
                            </DataGrid>

                            {/* {detalles.length > 0 && isEditing && (
                                <div className="mt-3 flex justify-end">
                                    <Button text="Aprobar todos" type="default" stylingMode="contained" onClick={aprobarTodos} />
                                </div>
                            )} */}
                        </div>
                    )} />
                </GroupItem>
            </Form>

            {/* Footer acciones */}
            <div className="flex flex-col sm:flex-row justify-end gap-3">
                <Button text={isEditing ? "Cerrar" : "Cancelar"} stylingMode="outlined" onClick={onCancel} />
                {!isEditing &&
                    <Button text={isEditing ? "Guardar cambios" : "Crear"} type="default" stylingMode="contained" disabled={creatingNew} onClick={submit} />
                }

            </div>
        </div>
    );
};

export default MovimientoForm;
