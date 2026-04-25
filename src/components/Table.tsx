import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { 
  setSortConfig, 
  setFilters, 
  setSearchTerm, 
  updateCell,
  setCurrentPage,
  setPageSize
} from '../store/tableSlice';
import { Input, Pagination, Space, Table as AntTable, Popconfirm, Button, Tooltip } from 'antd';
import { SearchOutlined, DeleteOutlined } from '@ant-design/icons';

const { Search } = Input;

const Table: React.FC = () => {
  const dispatch = useDispatch();
  const { 
    data, 
    columns, 
    loading, 
    currentPage, 
    pageSize, 
    total
  } = useSelector((state: RootState) => state.table);

  const [editingKey, setEditingKey] = useState<string | null>(null);

  // 处理列定义
  const antdColumns = useMemo(() => {
    return columns.map((column, index) => ({
      title: column.headerName,
      dataIndex: column.field,
      key: column.field,
      width: column.width || 150,
      editable: column.editable || false,
      sorter: (a: any, b: any) => {
        const valueA = a[column.field];
        const valueB = b[column.field];
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return valueA.localeCompare(valueB);
        }
        return (valueA || 0) - (valueB || 0);
      },
      filters: [
        {
          text: '筛选',
          value: '筛选',
        },
      ],
      onFilter: (value: any, record: any) => {
        return record[column.field]?.toString().includes(value);
      },
    }));
  }, [columns]);

  // 处理排序
  const handleSort = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field) {
      dispatch(setSortConfig({
        field: sorter.field,
        direction: sorter.order === 'ascend' ? 'asc' : 'desc'
      }));
    } else {
      dispatch(setSortConfig(null));
    }
  };

  // 处理筛选
  const handleFilter = (pagination: any, filters: any, sorter: any) => {
    dispatch(setFilters(filters));
  };

  // 处理单元格编辑
  const handleEdit = (record: any) => {
    setEditingKey(record.key);
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    dispatch(setSearchTerm(value));
  };

  // 处理分页
  const handlePageChange = (page: number, size: number) => {
    dispatch(setCurrentPage(page));
    dispatch(setPageSize(size));
  };

  // 模拟数据分页
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.map((item, index) => ({ ...item, key: index })).slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">表格数据</h2>
        <Space>
          <Search
            placeholder="搜索数据"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </Space>
      </div>
      
      <AntTable
        columns={antdColumns}
        dataSource={paginatedData}
        loading={loading}
        pagination={false}
        onChange={handleSort}
        rowClassName="editable-row"
        scroll={{ y: 600 }}
      />
      
      <div className="mt-4 flex justify-between items-center">
        <span>共 {total} 条记录</span>
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={total}
          onChange={handlePageChange}
          showSizeChanger
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>
    </div>
  );
};

export default Table;
