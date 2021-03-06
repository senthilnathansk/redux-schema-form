import { createSelector } from 'reselect';
import {connect} from "react-redux"
import * as React from 'react';
import {isValid,isPristine,isSubmitting,hasSubmitSucceeded,InjectedFormProps, ConfigProps, submit, reset} from "redux-form"

export const buttons = function(Buttons){

}

export let FormButton = (props)=>{
    return <button type={props.type} className={"btn btn-primary"+(props.disabled?" disabled":"")} disabled={props.disabled} onClick={props.onClick}>
        {props.children}
    </button>
};

export type ButtonProps = {
    disabled:boolean,
    type:"submit"|"button",
    onClick?:any,
    children:any
}

export const submittable = (disableResubmit)=>({valid,pristine,submitting,submitSucceeded})=>{
    return valid && !pristine && !submitting && !(disableResubmit && submitSucceeded);
}


export function setButton(button: React.StatelessComponent<ButtonProps>){
    FormButton = button;
}

export const injectSubmittable = (options:{  
    formName:string,
    type:"submit"|"reset",
    disableResubmit?:boolean
})=>{
    
    return Button=>(connect as any)(
        (createSelector as any)(
            [
                isValid(options.formName),
                isPristine(options.formName),
                isSubmitting(options.formName),
                hasSubmitSucceeded(options.formName)
            ],
            (valid,pristine,submitting,submitSucceeded)=>({
                disabled:!submittable(options.disableResubmit)({valid,pristine,submitting,submitSucceeded})
            })
        )
    )(class ConnectedButton extends React.PureComponent<any,any>{
        onClick=()=>{
            this.props.dispatch(options.type==='submit'?submit(options.formName):reset(options.formName))
        }
        render(){
            const {dispatch,...rest} = this.props;
            return <Button {...rest} type={options.type} onClick={this.onClick} />
        }
    })
}