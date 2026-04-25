import './App.css';
import PrintPreview from './components/PrintPreview';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setData, setColumns } from './store/tableSlice';
import { message, Modal, Progress } from 'antd';
import type { RootState } from './store';

function App() {
  const dispatch = useDispatch();
  const { data, columns } = useSelector((state: RootState) => state.table);
  const [hasData, setHasData] = useState(false);
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [pasteProgress, setPasteProgress] = useState(0);
  const [pasteInfo, setPasteInfo] = useState('');

  useEffect(() => {
    // 检查是否有数据
    if (data.length > 0 && columns.length > 0) {
      setHasData(true);
    } else {
      setHasData(false);
    }
  }, [data, columns]);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        const validTypes = ['.xlsx', '.xls', '.csv'];
        const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (validTypes.includes(fileExt)) {
          // 创建隐藏的文件输入框
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.xlsx,.xls,.csv';
          input.style.display = 'none';
          
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
              const file = target.files[0];
              // 这里可以添加文件处理逻辑
              message.info(`已选择文件: ${file.name}`);
            }
          };
          
          document.body.appendChild(input);
          input.click();
          document.body.removeChild(input);
        } else {
          message.error('只支持 Excel (.xlsx, .xls) 和 CSV 文件');
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData('text');
      const pastedHtml = e.clipboardData?.getData('text/html');
      
      // 显示进度弹窗
      setPasteModalVisible(true);
      setPasteProgress(0);
      setPasteInfo('正在解析粘贴数据...');
      
      // 使用 setTimeout 确保弹窗能显示出来
      setTimeout(() => {
        try {
          // 优先处理多维表格的 HTML 格式
          if (pastedHtml) {
            setPasteProgress(30);
            setPasteInfo('检测到多维表格格式，正在解析...');
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(pastedHtml, 'text/html');
            const bitableTable = doc.querySelector('.byte-bitable');
            
            if (bitableTable) {
               console.log('检测到多维表格结构');
               
               // 尝试从 dataset 中提取表头信息
               let schema = null;
               const bitableElement = bitableTable as HTMLElement;
               if (bitableElement.dataset.byteBitable) {
                 try {
                   schema = JSON.parse(bitableElement.dataset.byteBitable);
                   console.log('提取到的表头信息:', schema);
                 } catch (err) {
                   console.error('解析表头信息失败:', err);
                 }
               }
              
              if (schema && schema.header) {
                // 使用多维表格的表头信息
                setPasteProgress(60);
                setPasteInfo('正在处理多维表格数据...');
                
                const headers = schema.header.map((col: any, index: number) => ({
                  field: `col_${index}`,
                  headerName: col.name || `列${index + 1}`,
                  width: 150
                }));
                
                // 提取表格数据
                const rows = Array.from(bitableTable.querySelectorAll('tr'));
                const tableData = rows.map((row, rowIndex) => {
                  const rowData: Record<string, any> = {};
                  const cells = row.querySelectorAll('td');
                  headers.forEach((header, colIndex) => {
                    if (cells[colIndex]) {
                      rowData[header.field] = extractTextFromElement(cells[colIndex]);
                    } else {
                      rowData[header.field] = '';
                    }
                  });
                  return rowData;
                });
                
                setPasteProgress(90);
                setPasteInfo('正在导入多维表格数据...');
                
                dispatch(setColumns(headers));
                dispatch(setData(tableData));
                
                setPasteProgress(100);
                setPasteInfo(`导入完成：${tableData.length} 行 ${headers.length} 列`);
                
                setTimeout(() => {
                  setPasteModalVisible(false);
                  message.success(`成功导入多维表格数据：${tableData.length} 行 ${headers.length} 列`);
                }, 1000);
                return;
              }
            }
          }
          
          // 如果没有检测到多维表格格式，回退到纯文本处理
          if (pastedText) {
            setPasteProgress(30);
            setPasteInfo(`检测到 ${pastedText.split('\n').length} 行数据，正在分析表头...`);
            
            const rows = pastedText.split('\n').filter(row => row.trim());
            if (rows.length > 0) {
              // 检查第一行是否包含表头
              const firstRowCells = rows[0].split('\t');
              const hasHeader = firstRowCells.some(cell => 
                cell.trim().length > 0 && /[\u4e00-\u9fff\w\d]/.test(cell.trim())
              );
              
              let headers, tableData;
              
              if (hasHeader && rows.length > 1) {
                setPasteProgress(60);
                setPasteInfo('检测到表头，正在处理数据...');
                
                headers = firstRowCells.map((header, index) => ({
                  field: `col_${index}`,
                  headerName: header.trim() || `列${index + 1}`,
                  width: 150
                }));
                
                tableData = rows.slice(1).map((row, rowIndex) => {
                  const rowData: Record<string, any> = {};
                  const cells = row.split('\t');
                  headers.forEach((header, colIndex) => {
                    rowData[header.field] = cells[colIndex]?.trim() || '';
                  });
                  return rowData;
                });
              } else {
                setPasteProgress(60);
                setPasteInfo('未检测到表头，自动生成表头...');
                
                const maxCols = Math.max(...rows.map(row => row.split('\t').length));
                headers = Array.from({ length: maxCols }, (_, index) => ({
                  field: `col_${index}`,
                  headerName: `列${index + 1}`,
                  width: 150
                }));
                
                tableData = rows.map((row, rowIndex) => {
                  const rowData: Record<string, any> = {};
                  const cells = row.split('\t');
                  headers.forEach((header, colIndex) => {
                    rowData[header.field] = cells[colIndex]?.trim() || '';
                  });
                  return rowData;
                });
              }

              setPasteProgress(90);
              setPasteInfo('正在导入数据...');
              
              dispatch(setColumns(headers));
              dispatch(setData(tableData));
              
              setPasteProgress(100);
              setPasteInfo(`导入完成：${tableData.length} 行 ${headers.length} 列`);
              
              setTimeout(() => {
                setPasteModalVisible(false);
                message.success(`成功导入 ${tableData.length} 行数据，${headers.length} 列`);
              }, 1000);
            }
          }
        } catch (error) {
          console.error('粘贴数据解析错误:', error);
          setPasteModalVisible(false);
          message.error('粘贴的数据格式不正确，请确保是从多维表格复制的数据');
        }
      }, 100);
    };

    // 辅助函数：从 DOM 元素中提取文本
    const extractTextFromElement = (element: Element): string => {
      return element.textContent?.trim() || '';
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('paste', handlePaste);
    };
  }, [dispatch]);

  const handleClickUpload = () => {
    // 创建隐藏的文件输入框
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.style.display = 'none';
    
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        // 这里可以添加文件处理逻辑
        message.info(`已选择文件: ${file.name}`);
      }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  return (
    <div className="App">
      {hasData ? (
        <main>
          <PrintPreview />
        </main>
      ) : (
        <div 
          className="welcome-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            textAlign: 'center',
            backgroundColor: '#f5f5f5',
            padding: '20px'
          }}
        >
          <div 
            style={{
              padding: '40px',
              border: '2px dashed #d9d9d9',
              borderRadius: '8px',
              backgroundColor: 'white',
              cursor: 'pointer',
              margin: '0 auto',
              maxWidth: '600px',
              width: '100%'
            }}
            onClick={handleClickUpload}
          >
            <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#333' }}>
              拖拽本地文件至此 / 粘贴多维表格数据
            </h2>
            <p style={{ color: '#666', fontSize: '14px' }}>
              支持 Excel (.xlsx, .xls) 和 CSV 文件，或从飞书多维表格复制数据粘贴
            </p>
          </div>
        </div>
      )}

      <Modal
        title="正在处理粘贴数据"
        open={pasteModalVisible}
        footer={null}
        closable={false}
        mask={{ closable: false }}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Progress percent={pasteProgress} status="active" />
          <p style={{ marginTop: '16px', color: '#666' }}>{pasteInfo}</p>
        </div>
      </Modal>
    </div>
  );
}

export default App;
