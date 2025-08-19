import React, { useRef } from 'react';
import {
    DataGrid,
    Column,
    SearchPanel,
    Paging,
    Selection,
    Export
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import type DataGridType from 'devextreme/ui/data_grid';
import { Personal } from '../../types/Personal';

interface PersonalListProps {
    personal: Personal[];
    onEdit: (personal: Personal) => void;
    onDelete: (id: number) => void;
    onAdd: () => void;
}

const PersonalList: React.FC<PersonalListProps> = ({
    personal,
    onEdit,
    onDelete,
    onAdd
}) => {
    const dataGridRef = useRef<DataGridType | null>(null);

    const handleExport = () => {
        alert("viendo para exportar");
    };

    const renderSexo = (data: any) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${data.value === 'Masculino' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
            }`}>
            {data.value}
        </span>
    );

    const renderActionButtons = (data: any) => (
        <div className="flex space-x-2">
            <Button icon="edit" hint="Editar" onClick={() => onEdit(data.row.data)} stylingMode="text" type="normal" />
            <Button icon="trash" hint="Eliminar" onClick={() => onDelete(data.row.data.id)} stylingMode="text" type="normal" className="text-red-600 hover:text-red-800" />
        </div>
    );

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                    <h2 className="text-2xl font-bold text-gray-800">Personal</h2>
                    <div className="flex space-x-3">
                        <Button text="Exportar Excel" icon="exportxlsx" type="normal" stylingMode="outlined" onClick={handleExport} className="text-sm" />
                        <Button text="Agregar Personal" icon="plus" type="default" stylingMode="contained" onClick={onAdd} className="text-sm" />
                    </div>
                </div>
            </div>

            <div className="p-6">
                <DataGrid
                    ref={dataGridRef}
                    dataSource={personal}
                    keyExpr="id"
                    showBorders
                    rowAlternationEnabled
                    columnAutoWidth
                    wordWrapEnabled
                    className="w-full"
                >
                    <SearchPanel visible width={260} placeholder="Buscar personal..." />
                    <Paging enabled pageSize={10} />
                    <Selection mode="single" />
                    <Export enabled allowExportSelectedData formats={['xlsx']} />

                    <Column dataField="id" caption="ID" width={80} alignment="center" />
                    <Column dataField="nombres" caption="Nombres" minWidth={150} />
                    <Column dataField="ape_pat" caption="Apellido Paterno" minWidth={150} />
                    <Column dataField="ape_mat" caption="Apellido Materno" minWidth={150} />
                    <Column dataField="documento" caption="Documento" width={130} />
                    <Column dataField="tipo" caption="Tipo" width={120} />
                    <Column dataField="puesto" caption="Puesto" width={110} />
                    <Column dataField="area" caption="Área" width={100} />
                    <Column dataField="sexo" caption="Sexo" width={110} alignment="center" cellRender={renderSexo} />
                    <Column dataField="estado" caption="Estado" width={110} />
                    <Column caption="Acciones" width={120} alignment="center" cellRender={renderActionButtons} allowSorting={false} allowFiltering={false} />
                </DataGrid>
            </div>
        </div>
    );
};

export default PersonalList;
