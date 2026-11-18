import React, { useRef, useState } from 'react';
import { DataGrid, Column, SearchPanel, Paging, Selection, Export } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import type DataGridType from 'devextreme/ui/data_grid';
import { Personal } from '../../types/Personal';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import SelectBox from 'devextreme-react/cjs/select-box';

interface PersonalListProps {
    personal: Personal[];
    onEdit: (personal: Personal) => void;
    onDelete: (id: number) => void;
    onReactivar: (id: number) => void;
    estado: 0 | 1;
    onAdd: () => void;
    onRefresh: (estado: 0 | 1) => void
}

const ESTADOS = [
    { value: 1, text: 'Activo' },
    { value: 0, text: 'Cesado' },
];

const PersonalList: React.FC<PersonalListProps> = ({
    personal,
    onEdit,
    onDelete,
    onReactivar,
    estado,
    onAdd,
    onRefresh
}) => {
    // Estado elegido en el selector; solo se aplica al pulsar "Recargar"
    const [estadoFiltro, setEstadoFiltro] = useState<0 | 1>(estado);
    const dataGridRef = useRef<DataGridType | null>(null);
    //const dataGridRef = useRef<any>(null);


    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Personal');

        // Encabezados
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nombres', key: 'nombres', width: 20 },
            { header: 'Apellido Paterno', key: 'ape_pat', width: 20 },
            { header: 'Apellido Materno', key: 'ape_mat', width: 20 },
            { header: 'Documento', key: 'documento', width: 15 },
            { header: 'Tipo', key: 'tipo', width: 15 },
            { header: 'Puesto', key: 'puesto', width: 15 },
            { header: 'Área', key: 'area', width: 15 },
            { header: 'Sexo', key: 'sexo', width: 10 },
            { header: 'Estado', key: 'estado', width: 15 }
        ];

        // Datos
        personal.forEach(p => {
            worksheet.addRow({
                id: p.id,
                nombres: p.nombres,
                ape_pat: p.ape_pat,
                ape_mat: p.ape_mat,
                documento: p.documento,
                tipo: p.tipo,
                puesto: p.puesto_nombre,
                area: p.area_nombre,
                sexo: p.sexo,
                estado: p.estado === '1' ? 'Activo' : p.estado === '0' ? 'Cesado' : p.estado
            });
        });

        // Estilo opcional
        worksheet.getRow(1).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'Personal.xlsx');
    };


    const renderSexo = (data: any) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${data.value === 'Masculino' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
            }`}>
            {data.value}
        </span>
    );

    const renderActionButtons = (data: any) => (
        <div className="flex ">
            <Button icon="edit" hint="Editar" onClick={() => onEdit(data.row.data)} stylingMode="text" type="normal" />
            {estado === 0 ? (
                <Button
                    icon="undo" hint="Reactivar personal" onClick={() => onReactivar(data.row.data.id)}
                    stylingMode="text" type="success" />
            ) : (
                <Button
                    hint="Eliminar" onClick={() => onDelete(data.row.data.id)} stylingMode="text" type=""
                    className="text-red-600 hover:text-red-800" >
                    <span className="relative inline-block w-6 h-6">
                        <i className="dx-icon-user absolute inset-0 text-red-600 text-base" />
                        <i className="dx-icon-close absolute top-3 right-0 text-[10px] text-red-700" />
                    </span>

                </Button>
            )}
        </div>
    );
    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                    <h2 className="text-2xl font-bold text-gray-800">Lista Personal</h2>
                    <div className="flex space-x-3">
                        {/* select para seleccionar personal activo o cesado*/}
                        <SelectBox
                            dataSource={ESTADOS}
                            displayExpr="text"
                            valueExpr="value"
                            value={estadoFiltro}
                            placeholder="Seleccionar estado"
                            onValueChanged={(e) => {
                                if (e.value !== null && e.value !== undefined) setEstadoFiltro(e.value);
                            }}
                        />
                        {/* boton para recargar la lista*/}
                        <Button text="Recargar" icon="refresh" type="normal" stylingMode="outlined" onClick={() => onRefresh(estadoFiltro)} className="text-sm" />
                        <Button text="Exportar Excel" icon="exportxlsx" type="normal" stylingMode="outlined" onClick={handleExport} className="text-sm" />
                        <Button text="Agregar Personal" icon="plus" type="default" stylingMode="contained" onClick={onAdd} className="text-sm" />
                    </div>
                </div>
            </div>

            <div className="p-6">
                <DataGrid
                    key={`estado-${estado}`}
                    ref={dataGridRef}
                    dataSource={personal}
                    keyExpr="id"
                    showBorders
                    rowAlternationEnabled
                    columnAutoWidth
                    wordWrapEnabled
                    className="w-full"
                //columnHidingEnabled={true}
                >
                    <SearchPanel visible width={260} placeholder="Buscar personal..." />
                    <Paging enabled pageSize={10} />
                    <Selection mode="single" />
                    {/* <Export enabled allowExportSelectedData formats={['xlsx']} /> */}

                    <Column dataField="id" caption="ID" width={60} alignment="center" />
                    <Column dataField="nombres" caption="Nombres" minWidth={150} />
                    <Column dataField="ape_pat" caption="Apellido Paterno" minWidth={150} />
                    <Column dataField="ape_mat" caption="Apellido Materno" minWidth={150} />
                    <Column dataField="documento" caption="Documento" width={130} />
                    <Column dataField="tipo" caption="Tipo" width={120} />
                    <Column dataField="puesto_nombre" caption="Puesto" width={110} />
                    <Column dataField="area_nombre" caption="Área" width={100} />
                    <Column dataField="sexo" caption="Sexo" width={110} alignment="center" cellRender={renderSexo} />
                    {/* <Column dataField="estado" caption="Estado" width={110} /> */}
                    <Column caption="Acciones" width={120} alignment="center" cellRender={renderActionButtons} allowSorting={false} allowFiltering={false} />
                </DataGrid>
            </div>
        </div>
    );
};

export default PersonalList;
