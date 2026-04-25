import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { setData, setColumns } from '../store/tableSlice';
import { Button, Alert, Space, Spin, Modal, Progress } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const PasteTable: React.FC = () => {
  const dispatch = useDispatch();
  const { data, columns } = useSelector((state: RootState) => state.table);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState(false);
  const [showComponent, setShowComponent] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      e.preventDefault();
      const html = e.clipboardData?.getData('text/html') || '';
      if (html) {
        await processHTML(html);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const processHTML = async (htmlString: string) => {
    setIsLoading(true);
    setError(null);
    setPasteHint(false);
    setProgress(0);
    setProgressText('正在解析数据...');

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const bitableTable = doc.querySelector('.byte-bitable');

      if (!bitableTable) {
        throw new Error('无法识别数据格式，请确保复制的是飞书多维表格内容');
      }

      setProgress(10);
      setProgressText('正在解析表格结构...');

      let globalSchema: any = null;
      try {
        if ((bitableTable as HTMLElement).dataset.byteBitable) {
          globalSchema = JSON.parse((bitableTable as HTMLElement).dataset.byteBitable!);
        }
      } catch (err) {
        console.error(err);
      }

      if (!globalSchema || !globalSchema.header) {
        throw new Error('无法解析表格结构');
      }

      const globalRows = Array.from(bitableTable.querySelectorAll('tr'));

      setProgress(20);
      setProgressText('正在处理列定义...');

      // 处理列定义
      const newColumns = globalSchema.header.map((col: any, index: number) => ({
        headerName: col.name,
        field: `col_${index}`,
        width: col.width || 150,
        editable: false,
        type: col.type
      }));

      setProgress(30);
      setProgressText('正在提取数据...');

      // 处理数据行
      const newData: any[] = [];
      const totalRows = globalRows.length;
      
      globalRows.forEach((tr, rowIndex) => {
        const tds = tr.querySelectorAll('td');
        const row: any = {};
        newColumns.forEach((col: any, colIndex: number) => {
          if (colIndex < tds.length) {
            row[col.field] = extractText(tds[colIndex]);
          } else {
            row[col.field] = '';
          }
        });
        if (Object.keys(row).length > 0) {
          newData.push(row);
        }
        
        // 更新进度 (30% - 60%)
        if (rowIndex % 10 === 0 || rowIndex === totalRows - 1) {
          const currentProgress = 30 + Math.round((rowIndex / totalRows) * 30);
          setProgress(currentProgress);
          setProgressText(`正在提取数据... (${rowIndex + 1}/${totalRows})`);
        }
      });

      setProgress(60);
      setProgressText('正在计算列宽...');

      // 计算所有列的最大内容长度并设置自适应宽度
      const maxColumnWidth = 600; // 单列最大宽度限制
      
      newColumns.forEach((column: any, colIndex: number) => {
        const columnField = column.field;
        
        // 计算当前列的最大内容长度
        let maxLength = column.headerName.length;
        let maxContentWidth = column.headerName.length * 8 + 32; // 基础宽度 + padding
        
        newData.forEach((row) => {
          const cellContent = row[columnField] || '';
          if (cellContent.length > maxLength) {
            maxLength = cellContent.length;
          }
          // 计算内容宽度（每个字符约8px，加上padding）
          const contentWidth = cellContent.length * 8 + 32;
          if (contentWidth > maxContentWidth) {
            maxContentWidth = contentWidth;
          }
        });
        
        // 根据最大长度设置宽度（每个字符约8px，最小150px，最大maxColumnWidth）
        const adaptiveWidth = Math.min(maxColumnWidth, Math.max(150, maxContentWidth));
        column.width = adaptiveWidth;
        
        // 更新进度 (60% - 90%)
        const progressIncrement = Math.round((colIndex / newColumns.length) * 30);
        setProgress(60 + progressIncrement);
      });

      setProgress(90);
      setProgressText('正在更新状态...');

      // 更新Redux状态
      dispatch(setColumns(newColumns));
      dispatch(setData(newData));
      
      setProgress(100);
      setProgressText('完成！');
      
      // 延迟隐藏组件
      setTimeout(() => {
        setShowComponent(false);
        setIsLoading(false);
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : '粘贴失败，请重试');
      setIsLoading(false);
    }
  };

  const extractText = (node: Element): string => {
    let html = node.innerHTML;
    html = html.replace(/<br\s*\/?>/gi, '\n')
               .replace(/<\/div>/gi, '\n')
               .replace(/<\/p>/gi, '\n');
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.innerText.trim();
  };

  const handleShowPasteHint = () => {
    setPasteHint(true);
  };

  // 当有数据时，隐藏粘贴组件
  if (!showComponent || columns.length > 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">粘贴多维表格</h2>
        <Button
          icon={<CopyOutlined />}
          onClick={handleShowPasteHint}
        >
          粘贴提示
        </Button>
      </div>

      {pasteHint && (
        <Alert
          title="粘贴提示"
          description="请从飞书多维表格中复制内容，然后直接粘贴到页面任意位置"
          type="info"
          closable
          onClose={() => setPasteHint(false)}
          className="mb-4"
        />
      )}

      {error && (
        <Alert
          title="粘贴失败"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          className="mb-4"
        />
      )}

      {!isLoading && columns.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-gray-500">请从飞书多维表格复制内容并粘贴到此处</p>
        </div>
      )}

      {/* 粘贴进度弹窗 */}
      <Modal
        title="正在处理粘贴数据"
        open={isLoading}
        footer={null}
        closable={false}
        maskClosable={false}
        width={400}
        centered
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin size="large" style={{ marginBottom: '16px' }} />
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
            {progressText}
          </div>
          <Progress
            percent={progress}
            status="active"
            strokeColor={{ from: '#108ee9', to: '#87d068' }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default PasteTable;
