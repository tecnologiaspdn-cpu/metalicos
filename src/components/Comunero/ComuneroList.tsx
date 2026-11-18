import React, { useRef, useState } from 'react';
import { DataGrid, Column, SearchPanel, Paging, Selection, Export } from 'devextreme-react/data-grid';
import { Popup } from "devextreme-react/popup";
import { Button } from 'devextreme-react/button';
import type DataGridType from 'devextreme/ui/data_grid';
import { Comunero } from '../../types/Comunero';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { apiManager } from '../../services/api/ApiManager';
import { showMessage } from '../../hooks/useMessage';

interface ComuneroListProps {
    comunero: Comunero[];
    onEdit: (comunero: Comunero) => void;
    onDelete: (id: number) => void;
    onAdd: () => void;

}

const ComuneroList: React.FC<ComuneroListProps> = ({
    comunero,
    onEdit,
    onDelete,
    onAdd
}) => {
    const dataGridRef = useRef<DataGridType | null>(null);
    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Comunero');
        // Encabezados
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nombres', key: 'nombres', width: 20 },
            { header: 'DNI', key: 'dni', width: 20 },
            { header: 'Apellido Paterno', key: 'ape_pat', width: 20 },
            { header: 'Apellido Materno', key: 'ape_mat', width: 20 },
            { header: 'Sexo', key: 'sexo', width: 10 },
            { header: 'Fecha Nacimiento', key: 'fecha_nacimiento', width: 20 },
            { header: 'Fecha Admision', key: 'fecha_admision', width: 20 },
            { header: 'Domicilio', key: 'domicilio', width: 20 },
            { header: 'Total Familiares', key: 'total_familiares', width: 20 },
            { header: 'Parcela', key: 'parcela', width: 20 },
            { header: 'Ganado Mayor', key: 'ganado_mayor', width: 20 },
            { header: 'Ganado Menor', key: 'ganado_menor', width: 20 },
        ];

        // Datos
        comunero.forEach(p => {
            worksheet.addRow({
                id: p.id,
                nombres: p.nombres,
                ape_pat: p.ape_pat,
                ape_mat: p.ape_mat,
                sexo: p.sexo,
                fecha_nacimiento: p.fecha_nacimiento,
                fecha_admision: p.fecha_admision,
                domicilio: p.domicilio,
                total_familiares: p.total_familiares,
                parcela: p.parcela,
                ganado_mayor: p.ganado_mayor,
                ganado_menor: p.ganado_menor,
            });
        });

        // Estilo opcional
        worksheet.getRow(1).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'Comunero.xlsx');
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
            <Button
                hint="Eliminar" onClick={() => onDelete(data.row.data.id)} stylingMode="text" type=""
                className="text-red-600 hover:text-red-800" >
                <span className="relative inline-block w-6 h-6">
                    <i className="dx-icon-user absolute inset-0 text-red-600 text-base" />
                    <i className="dx-icon-close absolute top-3 right-0 text-[10px] text-red-700" />
                </span>
            </Button>
            {/*boton para poder cambiar la foto*/}
            <Button icon="photo" hint="Cambiar Foto" onClick={() => abrirModalFoto(data.row.data.id)} stylingMode="text" type="normal" />
        </div>
    );
    const abrirModalFoto = (id: number) => {
        setModalCambiarFoto({
            visible: true,
            comunero: id,
            nuevaFoto: null
        });
    }
    const cerrarModalFoto = () => setModalCambiarFoto({ visible: false, comunero: null, nuevaFoto: null });
    const [modalCambiarFoto, setModalCambiarFoto] = useState<{ visible: boolean; comunero: number | null, nuevaFoto: File | null }>({
        visible: false,
        comunero: null,
        nuevaFoto: null
    });
    const [loading, setLoading] = useState(false);
    const submitNuevaFoto = async () => {
        if (modalCambiarFoto.comunero && modalCambiarFoto.nuevaFoto) {
            try {
                setLoading(true);
                const formData = new FormData();
                formData.append('foto', modalCambiarFoto.nuevaFoto, modalCambiarFoto.nuevaFoto.name);
                formData.append('id', modalCambiarFoto.comunero.toString());
                const response = await apiManager.comunero.updateFoto(formData);
                if (response.code === 200) {
                    
                    cerrarModalFoto();
                    showMessage('Foto actualizada correctamente', 'success');
                } else {
                    showMessage('Error al actualizar la foto', 'error');
                }
            } catch (error) {
                showMessage('Error al actualizar la foto', 'error');
            } finally {
                setLoading(false);
            }

        }
    }
    return (
        <>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                        <h2 className="text-2xl font-bold text-gray-800">Lista Comunero</h2>
                        <div className="flex space-x-3">
                            <Button text="Exportar Excel" icon="exportxlsx" type="normal" stylingMode="outlined" onClick={handleExport} className="text-sm" />
                            <Button text="Agregar Comunero" icon="plus" type="default" stylingMode="contained" onClick={onAdd} className="text-sm" />
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <DataGrid
                        ref={dataGridRef}
                        dataSource={comunero}
                        keyExpr="id"
                        showBorders
                        rowAlternationEnabled
                        columnAutoWidth
                        wordWrapEnabled
                        className="w-full"
                    //columnHidingEnabled={true}
                    >
                        <SearchPanel visible width={260} placeholder="Buscar comunero..." />
                        <Paging enabled pageSize={10} />
                        <Selection mode="single" />
                        {/* <Export enabled allowExportSelectedData formats={['xlsx']} /> */}

                        <Column dataField="id" caption="ID" width={60} alignment="center" />
                        <Column dataField="nombres" caption="Nombres" minWidth={150} />
                        <Column dataField="ape_pat" caption="Apellido Paterno" minWidth={150} />
                        <Column dataField="ape_mat" caption="Apellido Materno" minWidth={150} />
                        <Column dataField="sexo" caption="Sexo" width={110} alignment="center" cellRender={renderSexo} />
                        <Column dataField="fecha_nacimiento" caption="Fecha Nacimiento" width={110} alignment="center" />
                        <Column dataField="fecha_admision" caption="Fecha Admision" width={110} alignment="center" />
                        {/* <Column dataField="domicilio" caption="Domicilio" minWidth={150} /> */}
                        <Column dataField="dni" caption="Dni" minWidth={100} />
                        <Column dataField="total_familiares" caption="Familiares" width={100} alignment="center" />
                        <Column dataField="parcela" caption="Parcela" minWidth={150} />
                        <Column dataField="ganado_mayor" caption="Ganado Mayor" minWidth={150} />
                        <Column dataField="ganado_menor" caption="Ganado Menor" minWidth={150} />
                        <Column caption="Acciones" width={120} alignment="center" cellRender={renderActionButtons} allowSorting={false} allowFiltering={false} />
                    </DataGrid>
                </div>
            </div>
            {/* Modal de aprobación/desaprobación */}
            <Popup
                visible={modalCambiarFoto.visible}
                onHiding={() => cerrarModalFoto()}
                showCloseButton
                dragEnabled
                resizeEnabled
                width={500}
                height="auto"
                title="Actualizar Foto"
            >
                <div className="p-4 space-y-4">
                    <div className="text-sm font-medium">Seleccione una foto:</div>
                    <input type="file" onChange={(e) => setModalCambiarFoto({ ...modalCambiarFoto, nuevaFoto: e.target.files ? e.target.files[0] : null })} />
                    <div className="flex justify-end gap-2">
                        <Button text="Cancelar" type="normal" onClick={() => cerrarModalFoto()} />
                        <Button text={loading ? "Actualizando..." : "Actualizar"} type="success" onClick={submitNuevaFoto} disabled={loading} />
                    </div>
                </div>
            </Popup>
        </>
    );
};

export default ComuneroList;
