import React, { useState } from 'react';
import { Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { useDispatch } from 'react-redux';
import { setData, setColumns, setLoading, setError } from '../store/tableSlice';

const { Dragger } = Upload;

const FileUpload: React.FC = () => {
  const dispatch = useDispatch();
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = (file: File) => {
    setUploading(true);
    dispatch(setLoading(true));

    try {
      if (file.name.endsWith('.csv')) {
        // 处理CSV文件
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const results = Papa.parse(text, {
              header: true
            });
            const data = results.data as any[];
            if (data.length > 0) {
              const firstRow = data[0] as Record<string, any>;
              const columns = Object.keys(firstRow).map((key) => ({
                field: key,
                headerName: key,
                width: 150,
                editable: true,
              }));
              dispatch(setData(data));
              dispatch(setColumns(columns));
              message.success('CSV文件解析成功');
            } else {
              message.error('CSV文件为空');
              dispatch(setError('CSV文件为空'));
            }
          } catch (error) {
            console.error('CSV解析错误:', error);
            message.error('CSV文件解析失败');
            dispatch(setError('CSV文件解析失败'));
          } finally {
            setUploading(false);
            dispatch(setLoading(false));
          }
        };
        reader.onerror = () => {
          message.error('文件读取失败');
          dispatch(setError('文件读取失败'));
          setUploading(false);
          dispatch(setLoading(false));
        };
        reader.readAsText(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // 处理Excel文件
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonData.length > 0) {
              const firstRow = jsonData[0] as Record<string, any>;
              const columns = Object.keys(firstRow).map((key) => ({
                field: key,
                headerName: key,
                width: 150,
                editable: true,
              }));
              dispatch(setData(jsonData));
              dispatch(setColumns(columns));
              message.success('Excel文件解析成功');
            } else {
              message.error('Excel文件为空');
              dispatch(setError('Excel文件为空'));
            }
          } catch (error) {
            console.error('Excel解析错误:', error);
            message.error('Excel文件解析失败');
            dispatch(setError('Excel文件解析失败'));
          } finally {
            setUploading(false);
            dispatch(setLoading(false));
          }
        };
        reader.onerror = () => {
          message.error('文件读取失败');
          dispatch(setError('文件读取失败'));
          setUploading(false);
          dispatch(setLoading(false));
        };
        reader.readAsBinaryString(file);
      } else {
        message.error('不支持的文件格式，请上传Excel或CSV文件');
        dispatch(setError('不支持的文件格式'));
        setUploading(false);
        dispatch(setLoading(false));
      }
    } catch (error) {
      console.error('文件处理错误:', error);
      message.error('文件处理失败');
      dispatch(setError('文件处理失败'));
      setUploading(false);
      dispatch(setLoading(false));
    }

    return false; // 阻止默认上传行为
  };

  const props = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    beforeUpload: handleFileUpload,
    onChange: (info: any) => {
      if (info.file.status === 'done') {
        // 这里不需要处理，因为我们在beforeUpload中已经处理了
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 文件上传失败`);
      }
    },
  };

  return (
    <div className="mb-6">
      <Dragger {...props} disabled={uploading}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
        <p className="ant-upload-hint">
          支持上传 Excel (.xlsx, .xls) 和 CSV 文件
        </p>
      </Dragger>
    </div>
  );
};

export default FileUpload;
