window['requestAnimationFrame'] = function(callback) {
    setTimeout(callback, 0);
} as any

import { FormFieldSchema} from '../..';
import "jest"
import {createStore, combineReducers, applyMiddleware, compose} from 'redux'
import {reducer as reduxFormReducer, getFormValues} from "redux-form"
import {renderIntoDocument,findRenderedDOMComponentWithClass, findRenderedComponentWithType, scryRenderedDOMComponentsWithTag,findRenderedDOMComponentWithTag, Simulate} from "react-dom/test-utils"
import * as React from 'react';
import { Store } from 'react-redux';
import { getType, clearTypes } from '../field';
import * as PropTypes from "prop-types"

function describeTestWithStore(Container:React.ComponentClass<any>,schema:FormFieldSchema[], initialValues:any, expectation:(wrapper,formValues?:any,store?:Store<any>)=>void){
    const reducer = combineReducers({
        form: reduxFormReducer
    })
    const store = createStore(reducer,{
        form:{}
    })
    class Form extends React.PureComponent<any,any>{
        getChildContext(){
            return {
                store
            }
        }
        static childContextTypes = {
            store: PropTypes.object
          };
        render(){
            const {ReduxSchemaForm} = require('../../index')
            const ReduxSchemaFormWithStore = ReduxSchemaForm as any
            return <ReduxSchemaFormWithStore
                form="default"
                schema={schema}
                initialValues={initialValues}
            />
        }
    }

    const wrapper = renderIntoDocument(<Container>
        <Form />
    </Container>)

    expectation(wrapper,()=>getFormValues("default")(store.getState()),store)
}

export const testTheme = (themeName,loadTheme,container:React.ComponentClass<any>)=>{
    describe(`Theme: ${themeName}`,()=>{
        clearTypes()
        loadTheme()
        
        test(`Expect 'text' type to be defined`,()=>{
            //findRenderedComponentWithType does not work with Stateless Component
            const TextInput = getType("text")
            expect(!!TextInput).toBeTruthy()
        })
    
        describeTestWithStore(container,[
            {
                key:"text1",
                label:"Text",
                type:"text"
            },{
                key:"text2",
                label:"Text2",
                type:"text",
                hide:true,
                listens:{
                    text1:v=>({
                        hide:v!=='b'
                    })
                }
            }
        ], {
            text1:"a"
        }, (wrapper,getFormValues)=>{
            const TextInput = getType("text")
            const elements:HTMLInputElement[] = scryRenderedDOMComponentsWithTag(wrapper,"input") as any
            test(`Expect 1 and only 1 'text' type Component to be shown`,()=>{
                expect(elements.length).toBe(1)
            })
            const [text1,text2] = elements
            test(`Expect 'text' type Component to be initialized`,()=>{
                expect(text1.value).toBe('a')
            })
            test(`Expect form state to be initialized`,()=>{
                expect(getFormValues().text1).toBe('a')
            })
            test(`Expect form state to updated`,()=>{
                text1.value = "b"
                Simulate.change(text1,{})
                expect(getFormValues().text1).toBe('b')
            })
            test(`Expect listening field to be updated by listened field`,()=>{
                text1.value = "b"
                Simulate.change(text1,{})
                expect(getFormValues().text1).toBe('b')
            })
            test(`Expect the second 'text' type Component to be rendered now`,()=>{
                const elements:HTMLInputElement[] = scryRenderedDOMComponentsWithTag(wrapper,"input") as any
                expect(elements.length).toBe(2)
            })
        })
    })
}