import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../store';
import PerfectScrollbar from 'react-perfect-scrollbar';
import Dropdown from '../components/Dropdown';
import { setPageTitle } from '../store/themeConfigSlice';
import IconHorizontalDots from '../components/Icon/IconHorizontalDots';
import IconDollarSign from '../components/Icon/IconDollarSign';
import IconInbox from '../components/Icon/IconInbox';
import IconTag from '../components/Icon/IconTag';
import IconCreditCard from '../components/Icon/IconCreditCard';
import IconShoppingCart from '../components/Icon/IconShoppingCart';
import IconArrowLeft from '../components/Icon/IconArrowLeft';
import Button from 'devextreme-react/button'
import DataGrid, { Column, Paging, FilterRow } from 'devextreme-react/data-grid'
import Chart, { Series, ArgumentAxis, Legend } from 'devextreme-react/chart'

const Index = () => {
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(setPageTitle('Prueba Metales'));
    });

    const [loading] = useState(false);


    type Product = { id: number; name: string; price: number; category: string; year: number }

    const data: Product[] = [
        { id: 1, name: 'Teclado', price: 39.9, category: 'Periféricos', year: 2022 },
        { id: 2, name: 'Ratón', price: 24.5, category: 'Periféricos', year: 2023 },
        { id: 3, name: 'Monitor', price: 189, category: 'Pantallas', year: 2024 },
        { id: 4, name: 'SSD', price: 79, category: 'Almacenaje', year: 2023 },
        { id: 5, name: 'Hub USB', price: 29, category: 'Accesorios', year: 2024 },
    ]
    const sayHi = () => alert('¡DevExtreme listo!')
    const [cantidad, setCantidad] = useState(0)
    return (
        <div>

            <h1 className="text-2xl font-bold">Pruebas DevExtreme</h1>

            <Button text="Probar botón" type="default" stylingMode="contained" onClick={sayHi} />

            <section>
                <h2 className="text-xl font-semibold mb-2">DataGrid</h2>
                <DataGrid
                    dataSource={data}
                    keyExpr="id"
                    showBorders={true}
                    columnAutoWidth={true}
                    height={360}
                    allowColumnReordering
                >
                    <FilterRow visible={true} />
                    <Paging defaultPageSize={5} />
                    <Column allowExporting={true} dataField="name" caption="Producto" />
                    <Column dataField="category" caption="Categoría" />
                    <Column dataField="price" caption="Precio" dataType="number" format="currency" />
                    <Column dataField="year" caption="Año" dataType="number" />
                </DataGrid>
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-2">Chart</h2>
                <Chart dataSource={data}>
                    <ArgumentAxis discreteAxisDivisionMode="betweenLabels" />
                    <Series type="bar" valueField="price" argumentField="name" />
                    <Legend visible={false} />
                </Chart>
            </section>
            <hr />
        </div>
    );
};

export default Index;
