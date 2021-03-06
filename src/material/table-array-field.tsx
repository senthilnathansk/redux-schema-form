import Dialog from 'material-ui/Dialog';
import * as React from 'react';
import { WrappedFieldArrayProps, FieldArray, reduxForm, change } from 'redux-form';
import { WidgetProps, addTypeWithWrapper } from '../field';
import { createSelector } from "reselect";
const dataSourceConfig = {text:"name",value:"value"};
import { renderFields } from '../render-fields';
import { ReduxSchemaForm } from '../form';
import { connect } from 'react-redux';
import { FormFieldSchema } from '../../index';
const {Grid} = require("ag-grid-presets")
const XLSX = require("xlsx")

type TableArrayFieldProps = WrappedFieldArrayProps<any>&WidgetProps;

function readWorkBook():Promise<any[]>{
    try{
        return new Promise((resolve,reject)=>{
            const id = "fjorandomstring";
            let input = document.querySelector("input#"+id) as HTMLInputElement;
            if(!input){
                input = document.createElement("input")
                input.id = id
                input.type='file'
                input.style.display="none"
                document.body.appendChild(input)
            }
            input.onchange=(e)=>{
                var reader = new FileReader();
                const file = (e.target as any).files[0]
                reader.onload = ()=> {
                    const data = XLSX.read(reader.result, {type:'binary'});
                    document.body.removeChild(input)
                    if(data.SheetNames.length)
                    resolve(XLSX.utils.sheet_to_json(data.Sheets[data.SheetNames[0]]))
                };
                reader.readAsBinaryString(file);
            }
            input.click()
        })
    }catch(e){
        console.error(e)
    }
}

function downloadWorkSheet(worksheet,fileName){
    function s2ab(s) {
        var buf = new ArrayBuffer(s.length);
        var view = new Uint8Array(buf);
        for (var i=0; i!=s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
        return buf;
    }
    try{
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook,worksheet,fileName)
        /* bookType can be any supported output type */
        var wopts = { bookType:'xlsx', bookSST:false, type:'binary' };

        var wbout = XLSX.write(workbook,wopts);

        /* the saveAs call downloads a file on the local machine */
        const blob = new Blob([s2ab(wbout)],{type:"application/octet-stream"});
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url;
        a.download=fileName+".xlsx";
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }catch(e){
        console.error(e)
    }
}

@(connect() as any)
class TableArrayField extends React.PureComponent<TableArrayFieldProps,any>{
    getActions=createSelector<TableArrayFieldProps,any,any>(
        p=>p.fieldSchema,
        fieldSchema=>[
        fieldSchema.disabled?null:{
            name:"编辑",
            call:(t,e)=>{
                const index = this.findIndex(t)
                this.api.forEachNode(x=>x.data === t && this.setState({
                    editedIndex:index
                },()=>{
                    window.dispatchEvent(new Event("resize"))
                }))
            }
        },
        fieldSchema.disableDelete?null:{
            name:"删除",
            call:(t,e)=>{
                const index = this.findIndex(t)
                this.api.forEachNode(x=>x.data === t && this.props.fields.remove(index))
            }
        },
        fieldSchema.disableCreate?null: {
            name:"添加",
            call:()=>{
                this.setState({
                    editedIndex:this.props.fields.length
                })
                this.props.fields.push(this.props.fieldSchema.defaultValue || {})
            },
            isStatic:true
        },
        fieldSchema.disableSort?null:{
            name:"前移",
            call:(t,e,x)=>{
                const index = this.findIndex(t)
                if(index>=0)
                    this.props.fields.swap(index,index-1)
            },
            enabled:(t,x)=>{
                const index = this.findIndex(t)
                return index>0
            }
        },
        fieldSchema.disableSort?null:{
            name:"后移",
            call:(t,e,x)=>{
                const index = this.findIndex(t)
                if(index>=0)
                    this.props.fields.swap(index,index+1)
            },
            enabled:(t,x)=>{
                if(this.props.fieldSchema.disableSort)
                    return false
                const index = this.findIndex(t)
                return index<this.props.fields.length-1
            }
        },
        {
            name:"导出",
            call:()=>{
                const schema = this.getGridSchema(this.props.fieldSchema).filter(x=>!x.hide)
                let rawData = this.props.fields.getAll()
                if(!rawData || !(rawData instanceof Array) || !rawData.length)
                rawData = [schema.reduce(function (res, y) {
                    res[y.label] = "";
                    return res;
                }, {})]
                const sheet = XLSX.utils.json_to_sheet(rawData.map(x=>{
                    return schema.reduce((res,y)=>{
                        res[y.label] = x[y.key]
                        return res
                    },{})
                }))
                downloadWorkSheet(sheet, this.props.fieldSchema.label)
            },
            isStatic:true
        },
        fieldSchema.disableImport?null:{
            name:"导入",
            call:(data)=>{
                readWorkBook().then(data=>{
                    const schema = this.getGridSchema(this.props.fieldSchema).filter(x=>!x.hide)
                    const newValues = data.map(item=>{
                        return schema.reduce((res,field)=>{
                            res[field.key] = item[field.label]
                            return res
                        },item)
                    })
                    if(confirm("是否替换原有数据? "))
                        this.changeArrayValues(newValues)
                    else {
                        this.changeArrayValues(this.props.fields.getAll().concat(newValues))
                    }
                })
            },
            isStatic:true
        },
        fieldSchema.disabled?null:{
            name:"批量编辑",
            call:(data,e,nodes)=>{
                if(!data || data.length<2)
                    return
                this.setState({
                    editedIndex:this.props.fields.length,
                    batchEditedData:data
                })
                this.props.fields.push({}) // insert a new child to provide a blank form.
            },
            isStatic:true,
            enabled:data=> data && data.length>=2
        }
    ].filter(x=>!!x))
    findIndex=(data)=>{
        for(let i =0;i<this.props.fields.length;i++){
            if(this.props.fields.get(i) === data)
                return i
        }
        return -1
    }
    changeArrayValues=newValues=>this.props.dispatch(change(this.props.meta.form,this.props.keyPath,newValues))
    onBatchEdit=()=>{
        //remove the added child
        const values = this.props.fields.getAll().slice()
        const batchEditValues = values.pop()
        const filledBatchEditValues = Object.keys(batchEditValues).reduce((values,key)=>{
            if(batchEditValues[key] !== null && batchEditValues[key] !== undefined)
                values[key] = batchEditValues[key]
            return values;
        },{})
        this.changeArrayValues(values.map((value)=>{
            if(this.state.batchEditedData.includes(value))
                return {
                    ...value,
                    ...batchEditValues
                }
            else 
                return value
        }))
    }
    state={
        editedIndex:-1,
        batchEditedData:null
    }
    api
    bindGridApi=api=>this.api=api;
    closeDialog=()=>{
        if(this.state.batchEditedData)
            this.onBatchEdit()
        this.setState({
            editedIndex:-1,
            batchEditedData:null
        })
    }
    stripLastItem = createSelector<any[],any[],any[]>(
        s=>s,
        s=>s.slice(0,-1)
    )
    getGridSchema = createSelector<FormFieldSchema,any,any>(
        s=>s,
        fieldSchema=>{
            if(fieldSchema.hideColumns && fieldSchema.hideColumns instanceof Array)
                return fieldSchema.children.map(x=>{
                    return {
                        ...x,
                        hide:fieldSchema.hideColumns.includes(x.key)
                    }
                })
            else return fieldSchema.children
        }
    )
    render(){
        const value=this.props.fields.getAll()||empty
        const {
            key,
            type,
            label,
            hide,
            fullWidth, //todo: should I put this presentation logic here?
            required,
            disabled,
            children,
            ...gridOptions
        } = this.props.fieldSchema
        const gridSchema=this.getGridSchema(this.props.fieldSchema)
        return <div>
            <label style={{marginLeft:10}}>{this.props.fieldSchema.label}{this.props.fields.length?`(${this.props.fields.length})`:""}</label>
            <Grid 
                data={this.state.batchEditedData?this.stripLastItem(value):value}
                schema={gridSchema}
                gridName={this.props.meta.form+"-"+this.props.keyPath}
                suppressAutoSizeToFit
                overlayNoRowsTemplate={`<div style="font-size:30px">${""}</div>`}
                height={300}
                selectionStyle="checkbox"
                actions={this.getActions(this.props)}
                gridApi={this.bindGridApi}
                {...gridOptions}
            />
            <Dialog autoScrollBodyContent autoDetectWindowHeight open={this.state.editedIndex >= 0 } onRequestClose={this.closeDialog}>
                {
                    this.state.editedIndex<0?null:renderFields(this.props.meta.form,this.props.fieldSchema.children,this.props.keyPath+"["+this.state.editedIndex+"]")
                }
            </Dialog>
        </div>
    }
}

const empty = [];

addTypeWithWrapper("table-array",(props)=>{
    return <div style={{paddingTop:25}}>
        <FieldArray name={props.keyPath} rerenderOnEveryChange component={TableArrayField} props={props}/>
    </div>
});