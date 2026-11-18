import React, { useEffect, useRef, useState } from 'react';
import { DataGrid, Column, SearchPanel, Paging, Pager } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import Button from 'devextreme-react/button';
import SelectBox from 'devextreme-react/select-box';
import DateBox from 'devextreme-react/date-box';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { apiManager } from '../../services/api/ApiManager';
import moment from 'moment';
import type DataGridType from 'devextreme/ui/data_grid';

interface Operacion {
    id: number;
    fecha_creacion: string;
    operador_id: number;
    operador: string;
    tipo_operacion_id: number;
    tipo_operacion: string;
    equipo_id: number;
    nombre_equipo: string | null;
    tonelaje_procesado: number;
    amperaje: number;
    porcentaje_solidos: number;
    porcentaje_malla200: number;
    presion_ciclones: number;
    densidad_uf: number;
    foto_1: string;
    foto_2: string;
    foto_3: string;
    estado: number;
}

interface TipoOperacion {
    id: string | number;
    nombre: string;
    estado?: number;
}

const TODOS_OPTION: TipoOperacion = { id: '0', nombre: 'Todos' };

const OperacionesPlanta: React.FC = () => {
    const dataGridRef = useRef<DataGridType | null>(null);

    const [rows, setRows] = useState<Operacion[]>([]);
    const [tiposOperacion, setTiposOperacion] = useState<TipoOperacion[]>([TODOS_OPTION]);
    const [loading, setLoading] = useState(false);

    const [fechaInicio, setFechaInicio] = useState<Date>(
        moment().startOf('month').toDate()
    );
    const [fechaFin, setFechaFin] = useState<Date>(new Date());
    const [tipoOperacionId, setTipoOperacionId] = useState<string>('0');

    const [selectedRow, setSelectedRow] = useState<Operacion | null>(null);
    const [showModal, setShowModal] = useState(false);

    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);

    useEffect(() => {
        cargarTiposOperacion();
    }, []);

    const cargarTiposOperacion = async () => {
        try {
            const resp = await (apiManager as any).operaciones.listarTipos();
            const tipos: TipoOperacion[] = (resp?.data ?? []).map((t: any) => ({
                ...t,
                id: String(t.id),
            }));
            setTiposOperacion([TODOS_OPTION, ...tipos]);
            await cargarDatos('0', fechaInicio, fechaFin);
        } catch (e) {
            console.error('Error cargando tipos de operación:', e);
        }
    };

    const cargarDatos = async (
        tipoId: string,
        inicio: Date,
        fin: Date
    ) => {
        setLoading(true);
        try {
            const body = {
                tipoOperacionId: tipoId,
                fechaInicio: moment(inicio).format('YYYY-MM-DD'),
                fechaFin: moment(fin).format('YYYY-MM-DD'),
            };
            const resp = await (apiManager as any).operaciones.listar(body);
            setRows(resp?.data ?? []);
        } catch (e) {
            console.error('Error cargando operaciones:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleRecargar = () => {
        cargarDatos(tipoOperacionId, fechaInicio, fechaFin);
    };

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Operaciones');
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Fecha', key: 'fecha_creacion', width: 22 },
            { header: 'Operador', key: 'operador', width: 30 },
            { header: 'Tipo Operación', key: 'tipo_operacion', width: 18 },
            { header: 'Equipo', key: 'nombre_equipo', width: 18 },
            { header: 'Tonelaje Procesado', key: 'tonelaje_procesado', width: 18 },
            { header: 'Amperaje', key: 'amperaje', width: 12 },
            { header: '% Sólidos', key: 'porcentaje_solidos', width: 12 },
            { header: '% Malla 200', key: 'porcentaje_malla200', width: 14 },
            { header: 'Presión Ciclones', key: 'presion_ciclones', width: 16 },
            { header: 'Densidad UF', key: 'densidad_uf', width: 14 },
        ];
        rows.forEach((r) => {
            worksheet.addRow({
                id: r.id,
                fecha_creacion: r.fecha_creacion,
                operador: r.operador,
                tipo_operacion: r.tipo_operacion,
                nombre_equipo: r.nombre_equipo ?? '-',
                tonelaje_procesado: r.tonelaje_procesado,
                amperaje: r.amperaje,
                porcentaje_solidos: r.porcentaje_solidos,
                porcentaje_malla200: r.porcentaje_malla200,
                presion_ciclones: r.presion_ciclones,
                densidad_uf: r.densidad_uf,
            });
        });
        worksheet.getRow(1).font = { bold: true };
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(
            new Blob([buffer], { type: 'application/octet-stream' }),
            `Operaciones_${moment().format('YYYYMMDD')}.xlsx`
        );
    };

    const abrirDetalle = (data: Operacion) => {
        setSelectedRow(data);
        setShowModal(true);
    };

    const abrirImagen = async (url: string) => {
        if (!url) return;
        setImageBase64(null);
        setImageLoading(true);
        setShowImageModal(true);
        try {
            const resp = await (apiManager as any).auth.getFoto({ fotoUrl: url });
            setImageBase64(resp?.value?.foto_base64 ?? null);
        } catch (e) {
            console.error('Error descargando imagen:', e);
        } finally {
            setImageLoading(false);
        }
    };

    const renderAcciones = (cell: any) => (
        <Button
            text="Ver detalle"
            type="default"
            stylingMode="outlined"
            onClick={() => abrirDetalle(cell.data)}
        />
    );

    const onRowPrepared = (e: any) => {
        if (e.rowType !== 'data') return;
        if (e.data.estado === 1) {
            e.rowElement.style.backgroundColor = '#d1d5db'; // plomo / gray-300
        } else if (e.data.estado === 2) {
            e.rowElement.style.backgroundColor = '#86efac'; // verde / green-300
        } else if (e.data.estado === 3) {
            e.rowElement.style.backgroundColor = '#fca5a5'; // rojo / red-300
        }
    };

    const renderModalContent = () => {
        if (!selectedRow) return null;
        return (
            <div style={{ padding: '12px 8px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <DetalleItem label="Operador" value={selectedRow.operador} colSpan={2} />
                    <DetalleItem label="Tipo Operación" value={selectedRow.tipo_operacion} />
                    <DetalleItem label="Equipo" value={selectedRow.nombre_equipo ?? '-'} />
                    <DetalleItem label="Tonelaje Procesado" value={String(selectedRow.tonelaje_procesado)} />
                    <DetalleItem label="Amperaje" value={String(selectedRow.amperaje)} />
                    <DetalleItem label="% Sólidos" value={String(selectedRow.porcentaje_solidos)} />
                    <DetalleItem label="% Malla 200" value={String(selectedRow.porcentaje_malla200)} />
                    <DetalleItem label="Presión Ciclones" value={String(selectedRow.presion_ciclones)} />
                    <DetalleItem label="Densidad UF" value={String(selectedRow.densidad_uf)} />
                    <DetalleItem
                        label="Fecha Registro"
                        value={moment(selectedRow.fecha_creacion).format('DD/MM/YYYY HH:mm')}
                    />
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button
                        text="Ver imagen 1"
                        icon="image"
                        type="normal"
                        stylingMode="outlined"
                        disabled={!selectedRow.foto_1}
                        onClick={() => abrirImagen(selectedRow!.foto_1)}
                    />
                    <Button
                        text="Ver imagen 2"
                        icon="image"
                        type="normal"
                        stylingMode="outlined"
                        disabled={!selectedRow.foto_2}
                        onClick={() => abrirImagen(selectedRow!.foto_2)}
                    />
                    <Button
                        text="Ver imagen 3"
                        icon="image"
                        type="normal"
                        stylingMode="outlined"
                        disabled={!selectedRow.foto_3}
                        onClick={() => abrirImagen(selectedRow!.foto_3)}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-full">
                <div className="bg-white rounded-lg shadow-lg">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                            <h2 className="text-2xl font-bold text-gray-800 whitespace-nowrap">
                                Operaciones Planta
                            </h2>
                            <div className="flex flex-wrap items-center gap-3">
                                <DateBox
                                    value={fechaInicio}
                                    type="date"
                                    displayFormat="dd/MM/yyyy"
                                    placeholder="Fecha inicio"
                                    width={150}
                                    onValueChanged={(e) => setFechaInicio(e.value)}
                                />
                                <DateBox
                                    value={fechaFin}
                                    type="date"
                                    displayFormat="dd/MM/yyyy"
                                    placeholder="Fecha fin"
                                    width={150}
                                    onValueChanged={(e) => setFechaFin(e.value)}
                                />
                                <SelectBox
                                    dataSource={tiposOperacion}
                                    displayExpr="nombre"
                                    valueExpr="id"
                                    value={tipoOperacionId}
                                    placeholder="Tipo de operación"
                                    width={180}
                                    onValueChanged={(e) => setTipoOperacionId(String(e.value))}
                                />
                                <Button
                                    text={loading ? 'Cargando...' : 'Recargar'}
                                    icon="refresh"
                                    type="normal"
                                    stylingMode="outlined"
                                    onClick={handleRecargar}
                                    disabled={loading}
                                />
                                <Button
                                    text="Exportar Excel"
                                    icon="exportxlsx"
                                    type="normal"
                                    stylingMode="outlined"
                                    onClick={handleExport}
                                    disabled={rows.length === 0}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="p-6">
                        <DataGrid
                            ref={dataGridRef}
                            dataSource={rows}
                            keyExpr="id"
                            showBorders
                            columnAutoWidth
                            wordWrapEnabled
                            noDataText={loading ? 'Cargando...' : 'Sin registros'}
                            onRowPrepared={onRowPrepared}
                        >
                            <SearchPanel visible width={240} placeholder="Buscar..." />
                            <Paging defaultPageSize={10} />
                            <Pager
                                showNavigationButtons
                                showPageSizeSelector
                                allowedPageSizes={[10, 20, 50]}
                            />
                            <Column
                                dataField="fecha_creacion"
                                caption="Fecha"
                                width={150}
                                cellRender={(c) => moment(c.value).format('DD/MM/YYYY HH:mm')}
                            />
                            <Column dataField="operador" caption="Operador" minWidth={180} />
                            <Column dataField="tipo_operacion" caption="Tipo Operación" width={140} />
                            <Column
                                dataField="nombre_equipo"
                                caption="Equipo"
                                width={130}
                                cellRender={(c) => c.value ?? '-'}
                            />
                            <Column dataField="tonelaje_procesado" caption="Tonelaje" width={110} alignment="right" />
                            <Column dataField="amperaje" caption="Amperaje" width={100} alignment="right" />
                            <Column dataField="porcentaje_solidos" caption="% Sólidos" width={100} alignment="right" />
                            <Column dataField="porcentaje_malla200" caption="% Malla 200" width={110} alignment="right" />
                            <Column dataField="presion_ciclones" caption="Presión Ciclones" width={130} alignment="right" />
                            <Column dataField="densidad_uf" caption="Densidad UF" width={110} alignment="right" />
                            <Column
                                caption="Acciones"
                                width={130}
                                alignment="center"
                                cellRender={renderAcciones}
                                allowSorting={false}
                                allowFiltering={false}
                            />
                        </DataGrid>
                    </div>
                </div>
            </div>

            {/* Modal Detalle */}
            <Popup
                visible={showModal}
                onHiding={() => setShowModal(false)}
                showCloseButton
                dragEnabled
                resizeEnabled
                width={700}
                height={560}
                title="Detalle de Operación"
                contentRender={renderModalContent}
            />

            {/* Modal Imagen */}
            <Popup
                visible={showImageModal}
                onHiding={() => { setShowImageModal(false); setImageBase64(null); }}
                showCloseButton
                dragEnabled
                resizeEnabled
                width={700}
                height={560}
                title="Vista de imagen"
                contentRender={() => (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        {imageLoading ? (
                            <p style={{ color: '#6b7280', fontSize: '14px' }}>Cargando imagen...</p>
                        ) : imageBase64 ? (
                            <img
                                src={`data:image/jpeg;base64,${imageBase64}`}
                                alt="Foto operación"
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                            />
                        ) : (
                            <p style={{ color: '#ef4444', fontSize: '14px' }}>No se pudo cargar la imagen.</p>
                        )}
                    </div>
                )}
            />
        </div>
    );
};

const DetalleItem: React.FC<{ label: string; value: string; colSpan?: number }> = ({
    label,
    value,
    colSpan,
}) => (
    <div
        style={{
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            padding: '12px',
            gridColumn: colSpan === 2 ? 'span 2' : undefined,
        }}
    >
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            {label}
        </p>
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{value}</p>
    </div>
);

export default OperacionesPlanta;
