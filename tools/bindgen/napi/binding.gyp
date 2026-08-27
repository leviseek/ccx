{
  "targets": [
    {
      "target_name": "ccx_hello_bindings",
      "sources": ["gen/ccx_hello_bindings.cpp"],
      "cflags": ["-std=c++20"],
      "conditions": [
        [
          "OS=='win'",
          {
            "msvs_settings": {
              "VCCLCompilerTool": {
                "AdditionalOptions": ["/std:c++20"]
              }
            }
          }
        ]
      ]
    }
  ]
}
