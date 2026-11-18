// src/components/Personal/MovimientosList.tsx
import React, { useState } from "react";
import DataGrid, { Column, Paging, Pager, SearchPanel } from "devextreme-react/data-grid";
import Button from "devextreme-react/button";
import type { MovimientoListadoUI } from "../../types/Movimientos";
import moment from "moment";
import { custom } from "devextreme/ui/dialog";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import notify from "devextreme/ui/notify";

type Props = {
    data: MovimientoListadoUI[];
    onEdit: (m: MovimientoListadoUI) => void;
    onToggleEstado?: (id: number, estado: string) => void; // opcional si luego implementas abrir/cerrar
};

const MovimientosList: React.FC<Props> = ({ data, onEdit, onToggleEstado }) => {
    const cerrarOAbrirCabeza = (id: number, estado: string) => {
        let mensaje_abrir = "";
        if (estado == "0") {
            mensaje_abrir = "*Abrir Solo por fase de prueba!!!";
            notify("*Abrir Solo por fase de prueba!!!", "warning", 2500);
            return;
        }
        const dialog = custom({
            title: "Confirmar cambio de estado: ",
            messageHtml: `<div>¿Está seguro de <strong>${estado == "1" ? "cerrar" : "abrir"} este movimiento</strong>?</div>
            <br/>${mensaje_abrir}
            `,
            buttons: [
                {
                    text: "Confirmar",
                    onClick: () => {
                        onToggleEstado && onToggleEstado(id, estado);
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
    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Personal');

        // Encabezados
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Fecha', key: 'fecha', width: 20 },
            { header: 'Tipo movimiento', key: 'tipo_movimiento', width: 20 },
            { header: 'Descripción', key: 'descripcion', width: 20 },
            { header: 'Estado', key: 'estado', width: 20 },
            { header: 'Empresa', key: 'empresa', width: 20 },
        ];

        // Datos
        data.forEach(p => {
            worksheet.addRow({
                id: p.id,
                fecha: p.fecha,
                tipo_movimiento: p.tipo_movimiento,
                descripcion: p.descripcion,
                estado: p.estado,
                empresa: p.razon_social
            });
        });

        // Estilo opcional
        worksheet.getRow(1).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'Personal.xlsx');
    };
    const usuarioCookie = localStorage.getItem('usuarioCookie')
    //console.log("usuarioCookie", usuarioCookie)
    const [empresaId, setEmpresaId] = useState<number>(
        (usuarioCookie ? JSON.parse(usuarioCookie).empresa_id : 0)
    );
    return (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex space-x-3">
                <Button text="Exportar Excel" icon="exportxlsx" type="normal" stylingMode="outlined" onClick={handleExport} className="text-sm" />

            </div>
            <DataGrid
                dataSource={data}
                showBorders={false}
                rowAlternationEnabled
                columnAutoWidth
                wordWrapEnabled
                className="w-full"
            >
                <Column dataField="id" caption="ID" width={80} />
                <Column
                    dataField="fecha"
                    caption="Fecha"
                    dataType="date"
                    calculateDisplayValue={(row: any) => moment(row.fecha).format("DD/MM/YYYY")}
                    width={140}
                />
                <Column dataField="tipo_movimiento" caption="Tipo movimiento" width={220} />
                <Column dataField="descripcion" caption="Descripción" />
                <Column
                    dataField="estado"
                    caption="Estado"
                    width={120}
                    cellRender={(cell) => {
                        const val = cell.data.estado as "ABIERTO" | "CERRADO";
                        const cls =
                            val === "ABIERTO"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-emerald-50 text-emerald-700";
                        return (
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
                                {val}
                            </span>
                        );
                    }}
                />
                <Column dataField="razon_social" caption="Empresa" />

                <Column
                    caption=""
                    width={220}
                    alignment="right"
                    cellRender={(cell) => {
                        const m = cell.data as MovimientoListadoUI;
                        return (
                            <div className="flex items-center justify-end gap-2">

                                <Button text={m.estado === "ABIERTO" ? "Gestionar" : "VER"} stylingMode="outlined" onClick={() => onEdit(m)} />
                                {onToggleEstado && (<>
                                    {empresaId == 1 && (
                                        <Button
                                            text={m.estado === "ABIERTO" ? "Cerrar" : "Abrir"}
                                            disabled={m.estado != "ABIERTO"}
                                            type="default"
                                            stylingMode="contained"
                                            onClick={() => {
                                                //0 ABIERTO, 1 CERRADO, 2 ELIMINADO
                                                //ventana de confirmacion

                                                //onToggleEstado(m.id, m.estado === "ABIERTO" ? "1" : "0");
                                                cerrarOAbrirCabeza(m.id, m.estado === "ABIERTO" ? "1" : "0");
                                            }}
                                        />
                                    )}
                                </>
                                )}
                            </div>
                        );
                    }}
                />
                <SearchPanel visible width={260} placeholder="Buscar registro..." />

                <Paging defaultPageSize={10} />
                <Pager showNavigationButtons showPageSizeSelector allowedPageSizes={[10, 20, 50]} />
            </DataGrid>
        </div>
    );
};

export default MovimientosList;
