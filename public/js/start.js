'use strict';

//const vConsole = new VConsole();
//const remoteConsole = new RemoteConsole("http://[remote server]/logio-post");
//window.datgui = new dat.GUI();

const base_url = "";

var vue_options = {
    el: "#top",
    mixins: [mixins_bootstrap],
    store: vue_store,
    router: vue_router,
    data: {
        selected_file: null,
        input_text: "",
        uploaded_datetime: 0,
        output_text: "",
        input_apikey: "",
        file_check_result: {},
    },
    computed: {
    },
    methods: {
        apikey_config_open: function(){
            this.input_apikey = this.apikey;
            this.dialog_open("#apikey_config_dialog");
        },
        apikey_config_save: function(){
            localStorage.setItem("clipping_apikey", this.input_apikey);
            this.apikey = this.input_apikey;
            this.dialog_close("#apikey_config_dialog");
        },
        text_output_browser: function(){
            if(!this.output_text.startsWith('http://') && !this.output_text.startsWith('https://')){
                this.toast_show('URLではありません。');
                return;
            }
            window.open(this.output_text, '_blank');
        },
        text_input_clear: function(){
            this.input_text = "";
        },
        text_output_clear: function(){
            this.output_text = "";
        },
        text_input_paste: async function(){
            this.input_text = await this.clip_paste();
            this.toast_show("クリップボードからペーストしました。");
        },
        text_output_copy: async function(){
            await this.clip_copy(this.output_text);
            this.toast_show("クリップボードにコピーしました。");
        },
        text_input_upload: async function(){
            try{
                var input = {
                    url: base_url + "/clipping-set-text",
                    body: {
                        text: this.input_text
                    },
                    api_key: this.apikey
                };
                var result = await do_http(input);
                console.log(result);
                this.toast_show("アップロードしました。");
            }catch(error){
                console.error(error);
                alert(error);
            }
        },
        text_output_download: async function(){
            try{
                var input = {
                    url: base_url + "/clipping-get-text",
                    method: "GET",
                    api_key: this.apikey
                };
                var result = await do_http(input);
                console.log(result);
                if( result.error ){
                    alert(result.error);
                    return;
                }
                this.output_text = result.text;
                this.toast_show("ダウンロードしました。");
            }catch(error){
                console.error(error);
                alert(error);
            }
        },
        file_callback: function(files){
            console.log(files);
            if( files.length > 0 )
                this.selected_file = files[0];
        },
        file_check: async function(){
            var input = {
                url: base_url + "/clipping-check-file",
                api_key: this.apikey
            };
            var result = await do_http(input);
            console.log(result);
            if( result.error ){
                alert(result.error);
                return;
            }
            this.file_check_result = result;
            this.dialog_open("#file_check_dialog");
        },
        file_upload: async function(){
            try{
                if( !this.selected_file ){
                    alert("ファイルが選択されていません。");
                    return;
                }

                var params = {
                    upfile: this.selected_file,
                    param: "param_value",
                    submit: "submit_value",
                };
                var input = {
                    url: base_url + "/clipping-set-file",
                    content_type: "multipart/form-data",
                    params: params,
                    api_key: this.apikey
                };
                var result = await do_http(input);
                console.log(result);
                this.uploaded_datetime = result.uploaded;
                this.toast_show("アップロードしました。");
            }catch(error){
                console.error(error);
                alert(error);
            }
        },
        file_download: async function(){
            try{
                var input = {
                    url: base_url + "/clipping-get-file",
                    method: "GET",
                    response_type: "file",
                    api_key: this.apikey
                };
                var result = await do_http(input);
                console.log(result);

                var blob = new Blob([result], {type: result.type} );
                var url = window.URL.createObjectURL(blob);

                var a = document.createElement("a");
                a.href = url;
                a.target = '_blank';
                a.download = result.name ? result.name : "undefined";
                this.toast_show("ダウンロードしました。");
                a.click();
                window.URL.revokeObjectURL(url);
            }catch(error){
                console.error(error);
                alert("ダウンロードに失敗しました。");
            }
        },
    },
    created: function(){
    },
    mounted: async function(){
        proc_load();

        this.apikey = localStorage.getItem("clipping_apikey");

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').then(async (registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }).catch((err) => {
                console.log('ServiceWorker registration failed: ', err);
            });
        }
    }
};
vue_add_data(vue_options, { progress_title: '' }); // for progress-dialog
vue_add_global_components(components_bootstrap);
vue_add_global_components(components_utils);

/* add additional components */
  
window.vue = new Vue( vue_options );
