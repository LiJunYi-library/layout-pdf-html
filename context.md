进入这个页面时 /layout?documentId=1 查询documentIds表 根据data_id查询datas数据
用户和大模型对话时的context里要加上datas表查询到的数据
上下文应该是
这是这次要渲染的pdf的数据结构json格式数据:查询出来的数据（这条上下文只要在这条document用ai布局 就不应该被上下文压缩和删除）
.
.
.
用户和大模型的对话... (这些上下文是可以被压缩的)
.
.
.